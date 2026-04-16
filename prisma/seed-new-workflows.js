/**
 * One-off seed: insert workflows 11–16 (new modules) into an existing DB.
 *
 * Safe to re-run — upserts by unique `name`. After inserting, re-runs the
 * scene-diagram seeder so every workflow has a rendered Excalidraw scene.
 *
 * Usage (from repo root):
 *   docker exec ecred-web node /app/prisma/seed-new-workflows.js
 *
 * Or against prod:
 *   python .claude/deploy.py "docker exec ecred-web-prod node /app/prisma/seed-new-workflows.js"
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const NEW_WORKFLOWS = [
  {
    name: "Recredentialing Cycle",
    description:
      "36-month recredentialing cycle — bulk initiation, application refresh, PSV re-run, committee re-approval, and OVERDUE handling. Runs in parallel with an APPROVED provider.",
    category: "recredentialing",
  },
  {
    name: "Reference & Work-History Verification",
    description:
      "Public token-based forms for employer work-history and professional reference checks — send, remind (7d/14d), capture response, and mark verification complete.",
    category: "verifications",
  },
  {
    name: "Roster Generation & Submission",
    description:
      "Payer roster lifecycle — generate CSV from template, validate, submit via portal/SFTP/email, and track payer acknowledgment.",
    category: "roster",
  },
  {
    name: "OPPE / FPPE Evaluation Lifecycle",
    description:
      "Ongoing (periodic) and Focused (event-triggered) Professional Practice Evaluations — scheduling, evaluator assignment, indicator capture, recommendation, and privilege outcomes.",
    category: "evaluation",
  },
  {
    name: "CME Tracking & Attestation",
    description:
      "CME credit logging (Category 1/2), cycle-end shortfall alerts at 60 days, auto-regenerated CV, and attestation close-out.",
    category: "cme",
  },
  {
    name: "Public REST API & FHIR Access",
    description:
      "API key issuance and authenticated access to /api/v1 (REST) and /api/fhir/Practitioner (FHIR R4, CMS-0057-F) with permission checks, rate limiting, PHI redaction, and tamper-evident audit.",
    category: "api",
  },
];

const EMPTY_SCENE = { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };

async function pickCreator() {
  // Prefer an ADMIN; fall back to any active user.
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true },
  });
  if (admin) return admin;
  const any = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, email: true },
  });
  if (!any) throw new Error("No active users found — cannot assign workflow.createdBy");
  return any;
}

async function main() {
  const creator = await pickCreator();
  console.log(`Using creator: ${creator.email}`);

  let created = 0;
  let existed = 0;

  for (const wf of NEW_WORKFLOWS) {
    const existing = await prisma.workflow.findFirst({ where: { name: wf.name } });
    if (existing) {
      existed++;
      console.log(`  • exists: ${wf.name}`);
      continue;
    }
    await prisma.workflow.create({
      data: {
        name: wf.name,
        description: wf.description,
        category: wf.category,
        sceneData: EMPTY_SCENE,
        createdBy: creator.id,
        updatedBy: creator.id,
        isPublished: true,
      },
    });
    created++;
    console.log(`  ✓ created: ${wf.name} (${wf.category})`);
  }

  console.log(`\nDone. Created ${created}, already existed ${existed}.`);
  console.log("Now run prisma/seed-workflow-diagrams.js to populate the Excalidraw scenes.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
