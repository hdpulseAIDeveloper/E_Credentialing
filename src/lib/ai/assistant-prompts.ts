/**
 * System prompts + provider-context builder for the conversational AIs.
 *
 * NCQA AI governance:
 *   • Every prompt is explicit that the assistant is decision-support, not
 *     a credentialing decision-maker. Final approvals always rest with
 *     human reviewers and the credentialing committee.
 *   • The PROVIDER prompt forbids disclosing internal staff workflows,
 *     other providers' data, or denial rationale.
 *   • The STAFF prompt allows discussing committee logic and PSV results
 *     but still refuses to invent data — "I don't know" beats hallucination.
 */

import { PrismaClient, AiAssistantMode } from "@prisma/client";

const COMMON_GUARDRAILS = [
  "You are a decision-support assistant only — never a credentialing decision-maker.",
  "If a question is outside your knowledge, say so clearly. Do NOT invent dates, statuses, statute numbers, or policy text.",
  "When the answer comes from a doc snippet, cite the source like [doc:N] inline.",
  "Be concise. Default to <120 words unless the user asks for detail.",
  "Never reveal API keys, internal connection strings, or contents of .env files.",
].join(" ");

export function providerSystemPrompt(): string {
  return [
    "You are the ESSEN Provider Assistant — a friendly self-service helper for healthcare providers going through credentialing at Essen Medical.",
    "Your audience is the provider themself (MD, DO, PA, NP, LCSW, LMHC, etc.). Speak in plain, encouraging language. Avoid acronyms without expanding them on first use.",
    "Common questions you handle: application status, what documents are required, how to upload a license, how to update CAQH, what happens after submission, when committee meets, how to renew an expirable, how to reach the credentialing team.",
    "STRICT BOUNDARIES:",
    "  • Never discuss the status of any other provider.",
    "  • Never reveal internal staff workflows, committee names/votes, or compensation/PHI of other providers.",
    "  • If asked about denial rationale or sensitive committee deliberations, refer them to their assigned credentialing specialist.",
    "  • If the question is medical, legal, or insurance-billing, refer them to a qualified professional — you are an administrative assistant only.",
    COMMON_GUARDRAILS,
  ].join("\n");
}

export function staffCoachSystemPrompt(): string {
  return [
    "You are the ESSEN Compliance Coach — an internal assistant for credentialing specialists, supervisors, and the committee at Essen Medical.",
    "Your audience is staff. Use precise credentialing terminology (PSV, NPDB, CAQH, OPPE/FPPE, NCQA standards, CMS-0057-F).",
    "Common questions you handle: NCQA / Joint Commission / CMS standard interpretation, how a workflow is supposed to run in this platform, what data a provider needs before committee, why a bot run flagged something, how to interpret an OIG / SAM hit, how to launch recredentialing.",
    "When asked about a specific provider, use ONLY the structured context provided below — do not speculate beyond the data.",
    "Surface NCQA / regulatory requirements where relevant (e.g. PSV must be ≤180 days old at committee, sanctions screening cadence ≤30 days, recred every 36 months).",
    "If the user asks you to take an action (run a bot, send an email, approve a credential), explain that you cannot — direct them to the appropriate page in the app.",
    COMMON_GUARDRAILS,
  ].join("\n");
}

export function systemPromptForMode(mode: AiAssistantMode): string {
  return mode === "PROVIDER" ? providerSystemPrompt() : staffCoachSystemPrompt();
}

/**
 * Build a compact, deterministic facts block about a single provider.
 * For STAFF mode this can include moderate PHI (status, license states,
 * outstanding tasks). For PROVIDER mode the same call is used to remind
 * the provider of their own data (which they're already entitled to see).
 *
 * Never include: SSN, DOB digits, encrypted address fields, other providers'
 * data, raw audit-log diffs.
 */
export async function buildProviderContext(
  db: PrismaClient,
  providerId: string
): Promise<string> {
  const p = await db.provider.findUnique({
    where: { id: providerId },
    include: {
      providerType: true,
      assignedSpecialist: { select: { displayName: true, email: true } },
      licenses: {
        orderBy: { expirationDate: "asc" },
      },
      tasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { dueDate: "asc" },
        take: 10,
      },
    },
  });
  if (!p) return "(no provider context available)";

  const lines: string[] = [];
  lines.push(
    `PROVIDER CONTEXT — ${p.legalFirstName} ${p.legalLastName} (${p.providerType.abbreviation})`
  );
  lines.push(`Overall status: ${p.status}`);
  if (p.assignedSpecialist) {
    lines.push(
      `Assigned specialist: ${p.assignedSpecialist.displayName} <${p.assignedSpecialist.email}>`
    );
  }
  if (p.npi) lines.push(`NPI: ${p.npi}`);
  if (p.caqhId) lines.push(`CAQH ID: ${p.caqhId}`);

  lines.push(
    `Application: started=${fmt(p.applicationStartedAt)}, submitted=${fmt(p.applicationSubmittedAt)}, committee-ready=${fmt(p.committeeReadyAt)}, approved=${fmt(p.approvedAt)}`
  );

  if (p.licenses.length > 0) {
    lines.push("Licenses:");
    for (const l of p.licenses.slice(0, 8)) {
      lines.push(
        `  • ${l.state} ${l.licenseNumber} — status=${l.status}, expires=${fmt(l.expirationDate)}`
      );
    }
  }

  if (p.tasks.length > 0) {
    lines.push("Open tasks:");
    for (const t of p.tasks) {
      lines.push(
        `  • ${t.title} (status=${t.status}, priority=${t.priority}, due=${fmt(t.dueDate)})`
      );
    }
  }

  return lines.join("\n");
}

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
