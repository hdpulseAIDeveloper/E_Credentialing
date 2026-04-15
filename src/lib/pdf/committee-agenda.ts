/**
 * Committee agenda PDF generation.
 * Compiles summary data for all providers in a committee session.
 */

import { db } from "@/server/db";
import { generateCommitteeSummaryHtml, gatherSummaryData } from "./committee-summary";

export interface AgendaData {
  sessionDate: string;
  sessionTime?: string;
  location?: string;
  committeeMemberNames: string[];
  providers: Array<{
    order: number;
    name: string;
    providerType: string;
    npi: string;
    summaryHtml: string;
  }>;
}

export async function gatherAgendaData(sessionId: string): Promise<AgendaData> {
  const session = await db.committeeSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      providers: {
        include: {
          provider: {
            include: { providerType: true },
          },
        },
        orderBy: { agendaOrder: "asc" },
      },
    },
  });

  const memberNames: string[] = [];
  if (session.committeeMemberIds.length > 0) {
    const members = await db.user.findMany({
      where: { id: { in: session.committeeMemberIds } },
      select: { displayName: true },
    });
    memberNames.push(...members.map((m) => m.displayName ?? "Unknown"));
  }

  const providers: AgendaData["providers"] = [];
  for (const cp of session.providers) {
    const summaryHtml = await generateCommitteeSummaryHtml(cp.providerId);
    providers.push({
      order: cp.agendaOrder,
      name: `${cp.provider.legalFirstName} ${cp.provider.legalLastName}`,
      providerType: cp.provider.providerType.name,
      npi: cp.provider.npi ?? "N/A",
      summaryHtml,
    });
  }

  return {
    sessionDate: session.sessionDate.toLocaleDateString(),
    sessionTime: session.sessionTime ?? undefined,
    location: session.location ?? undefined,
    committeeMemberNames: memberNames,
    providers,
  };
}

export async function generateAgendaHtml(sessionId: string): Promise<string> {
  const data = await gatherAgendaData(sessionId);

  const sections: string[] = [];

  sections.push(`<h1>Credentialing Committee Agenda</h1>`);
  sections.push(`<p><strong>Date:</strong> ${data.sessionDate}</p>`);
  if (data.sessionTime) sections.push(`<p><strong>Time:</strong> ${data.sessionTime}</p>`);
  if (data.location) sections.push(`<p><strong>Location:</strong> ${data.location}</p>`);
  sections.push(`<p><strong>Committee Members:</strong> ${data.committeeMemberNames.join(", ") || "TBD"}</p>`);
  sections.push(`<hr>`);

  sections.push(`<h2>Providers for Review (${data.providers.length})</h2>`);
  sections.push(`<ol>`);
  for (const p of data.providers) {
    sections.push(`<li>${p.name} — ${p.providerType} (NPI: ${p.npi})</li>`);
  }
  sections.push(`</ol>`);
  sections.push(`<hr>`);

  for (const p of data.providers) {
    sections.push(`<div style="page-break-before: always;">`);
    sections.push(`<h2>Provider ${p.order}: ${p.name}</h2>`);
    sections.push(p.summaryHtml);
    sections.push(`</div>`);
  }

  sections.push(`<hr><p><em>Agenda generated: ${new Date().toLocaleString()}</em></p>`);

  return sections.join("\n");
}
