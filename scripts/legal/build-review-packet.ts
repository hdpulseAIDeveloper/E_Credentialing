/**
 * scripts/legal/build-review-packet.ts — Collapse B-007 to one yes/no.
 *
 * B-007 (legal-bundle approval) currently asks Legal to chase down a
 * version table, the constants in src/lib/legal/copy.ts, the markdown
 * sources under docs/legal/, and a list of every audit row that
 * references the bundle. This script assembles all of that into a
 * single shareable PDF + zip so Legal's only remaining task is "approve
 * v1.0-draft -> v1.0".
 *
 * Output (default: ./out/legal-review-packet/):
 *   v1.0-draft/
 *     00-cover.md                  human-readable cover sheet
 *     01-versions.md               LEGAL_COPY_VERSION + status + dates
 *     02-attestation-questions.md  every yes/no/explain in attestation
 *     03-privacy-notice.md         rendered from PRIVACY_NOTICE constant
 *     04-terms-of-service.md       rendered from TERMS_OF_SERVICE constant
 *     05-cookie-notice.md          rendered from COOKIE_NOTICE constant
 *     06-hipaa-notice.pdf          copy of the canonical HIPAA notice PDF
 *     07-source-files/             every docs/legal/*.md verbatim
 *     08-runtime-constants.json    machine-readable dump of every legal constant
 *     09-attestation-acknowledgements.csv  audit log of provider attestations to date
 *     CHECKLIST.md                 one-page yes/no for Legal
 *
 * Wired into:
 *   `npm run legal:packet` (added in package.json)
 *   `python .claude/deploy.py "docker exec ecred-web-prod npm run legal:packet"`
 *   then SCP the resulting folder to Legal's secure dropbox.
 *
 * Idempotent. Re-running with the same LEGAL_COPY_VERSION overwrites the
 * folder for that version (so a typo fix in v1.0-draft doesn't fork the
 * packet history). A new version cuts a new folder.
 *
 * Usage:
 *   npx tsx scripts/legal/build-review-packet.ts
 *   npx tsx scripts/legal/build-review-packet.ts --out ./somewhere/else
 *   npx tsx scripts/legal/build-review-packet.ts --include-acks  # query DB
 */
import {
  ATTESTATION_CONFIRMATION_BODY,
  ATTESTATION_CONFIRMATION_HEADING,
  ATTESTATION_HEADING,
  ATTESTATION_LEAD,
  ATTESTATION_QUESTIONS,
  ATTESTATION_SIGNATURE_DISCLAIMER,
  COOKIE_NOTICE,
  COOKIE_NOTICE_SUMMARY,
  HIPAA_NOTICE_POINTER,
  LEGAL_CONTACTS,
  LEGAL_COPY_EFFECTIVE_DATE,
  LEGAL_COPY_LAST_REVIEWED_AT,
  LEGAL_COPY_STATUS,
  LEGAL_COPY_VERSION,
  PRIVACY_NOTICE,
  PRIVACY_NOTICE_SUMMARY,
  TERMS_OF_SERVICE,
  TERMS_OF_SERVICE_SUMMARY,
  type LegalBlock,
  type LegalDocument,
} from "@/lib/legal/copy";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

interface Args {
  out: string;
  includeAcks: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { out: "out/legal-review-packet", includeAcks: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) {
      args.out = argv[i + 1]!;
      i++;
    } else if (a === "--include-acks") {
      args.includeAcks = true;
    }
  }
  return args;
}

function renderBlock(b: LegalBlock): string {
  switch (b.kind) {
    case "heading":
      return `${"#".repeat(b.level)} ${b.text}`;
    case "paragraph":
      return b.text;
    case "callout":
      return `> ${b.text.replaceAll("\n", "\n> ")}`;
    case "list": {
      const marker = b.ordered ? (i: number) => `${i + 1}. ` : () => "- ";
      return b.items.map((item, i) => `${marker(i)}${item}`).join("\n");
    }
    case "table": {
      const head = `| ${b.headers.join(" | ")} |`;
      const sep = `| ${b.headers.map(() => "---").join(" | ")} |`;
      const rows = b.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
      return [head, sep, rows].join("\n");
    }
  }
}

function renderDocument(doc: LegalDocument): string {
  const status = `**Status:** ${doc.status}  **Version:** ${doc.version}  **Effective:** ${doc.effectiveDate ?? "(pending Legal approval)"}`;
  const head = [`# ${doc.title}`, doc.lead ? `_${doc.lead}_` : "", status, ""].filter(Boolean);
  const body = doc.blocks.map(renderBlock);
  return [...head, ...body].join("\n\n");
}

async function writeFileSafe(path: string, contents: string | Buffer): Promise<void> {
  console.log(`  write ${path}`);
  await writeFile(path, contents);
}

async function buildCover(out: string): Promise<void> {
  const md = `# ESSEN Credentialing Platform — Legal Review Packet

**Version under review:** \`${LEGAL_COPY_VERSION}\`
**Status:** ${LEGAL_COPY_STATUS}
**Last edited:** ${LEGAL_COPY_LAST_REVIEWED_AT}
**Effective date:** ${LEGAL_COPY_EFFECTIVE_DATE ?? "(pending — set on approval)"}
**Generated:** ${new Date().toISOString()}

## What is this packet?

A complete snapshot of every piece of legal language the application
shows to a provider, payer-rep, or staff member, plus the audit-log
schema that records each attestation. Reviewing this packet lets Legal
approve the bundle in one pass — there is no need to chase down extra
sources.

## What we need from you

Open \`CHECKLIST.md\` and tick yes/no for each item. Reply to
${LEGAL_CONTACTS.privacyOfficer} with the marked-up checklist. Once we
receive a yes/yes/yes/yes/yes, we set \`LEGAL_COPY_STATUS = "APPROVED"\`,
populate \`LEGAL_COPY_EFFECTIVE_DATE\`, bump the version to \`v1.0\`,
and ship.

## What's in this folder

| File | What it is |
|---|---|
| 00-cover.md | This file. |
| 01-versions.md | Single source of truth for version + dates + contacts. |
| 02-attestation-questions.md | Every yes/no/explain question in the credentialing attestation. |
| 03-privacy-notice.md | Rendered from the runtime constant. |
| 04-terms-of-service.md | Rendered from the runtime constant. |
| 05-cookie-notice.md | Rendered from the runtime constant. |
| 06-hipaa-notice.pdf | Canonical HIPAA Notice of Privacy Practices PDF (pointer). |
| 07-source-files/ | Authoring source markdown (\`docs/legal/*.md\`). |
| 08-runtime-constants.json | Machine-readable dump of every constant in \`src/lib/legal/copy.ts\`. |
| 09-attestation-acknowledgements.csv | Provider attestations to date, if --include-acks was passed. |
| CHECKLIST.md | One-page yes/no Legal sign-off. |
`;
  await writeFileSafe(join(out, "00-cover.md"), md);
}

async function buildVersions(out: string): Promise<void> {
  const md = `# Versions and Effective Dates

| Field | Value |
|---|---|
| LEGAL_COPY_VERSION | \`${LEGAL_COPY_VERSION}\` |
| LEGAL_COPY_STATUS | \`${LEGAL_COPY_STATUS}\` |
| LEGAL_COPY_LAST_REVIEWED_AT | \`${LEGAL_COPY_LAST_REVIEWED_AT}\` |
| LEGAL_COPY_EFFECTIVE_DATE | \`${LEGAL_COPY_EFFECTIVE_DATE ?? "(null — set on approval)"}\` |
| Privacy Officer | ${LEGAL_CONTACTS.privacyOfficer} |
| Security Contact | ${LEGAL_CONTACTS.security} |
| Credentialing Onboarding | ${LEGAL_CONTACTS.credentialing} |

## Attestation snapshot

- **Heading:** ${ATTESTATION_HEADING}
- **Lead:** ${ATTESTATION_LEAD}
- **Confirmation heading:** ${ATTESTATION_CONFIRMATION_HEADING}
- **Confirmation body:** ${ATTESTATION_CONFIRMATION_BODY}
- **Signature disclaimer:** ${ATTESTATION_SIGNATURE_DISCLAIMER}

## Versioning rule (binding)

\`LEGAL_COPY_VERSION\` is bumped any time **any** document changes in a
non-cosmetic way (typo fixes are cosmetic). Every attestation audit log
entry records the version the provider agreed to
(\`afterState.legalCopyVersion\`), so historical attestations remain
enforceable even after the language evolves.
`;
  await writeFileSafe(join(out, "01-versions.md"), md);
}

async function buildAttestation(out: string): Promise<void> {
  const lines: string[] = ["# Attestation Questions", "", `_${ATTESTATION_LEAD}_`, ""];
  for (const [i, q] of ATTESTATION_QUESTIONS.entries()) {
    lines.push(`## Q${i + 1}. (id \`${q.id}\`)`);
    lines.push("");
    lines.push(q.text);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`**Signature disclaimer shown to provider:** ${ATTESTATION_SIGNATURE_DISCLAIMER}`);
  await writeFileSafe(join(out, "02-attestation-questions.md"), lines.join("\n"));
}

async function buildLegalDocs(out: string): Promise<void> {
  await writeFileSafe(
    join(out, "03-privacy-notice.md"),
    `> Summary: ${PRIVACY_NOTICE_SUMMARY}\n\n` + renderDocument(PRIVACY_NOTICE),
  );
  await writeFileSafe(
    join(out, "04-terms-of-service.md"),
    `> Summary: ${TERMS_OF_SERVICE_SUMMARY}\n\n` + renderDocument(TERMS_OF_SERVICE),
  );
  await writeFileSafe(
    join(out, "05-cookie-notice.md"),
    `> Summary: ${COOKIE_NOTICE_SUMMARY}\n\n` + renderDocument(COOKIE_NOTICE),
  );
  const hipaaPdf = HIPAA_NOTICE_POINTER as { localPath?: string; description?: string };
  if (hipaaPdf.localPath && existsSync(resolve(hipaaPdf.localPath))) {
    try {
      await copyFile(resolve(hipaaPdf.localPath), join(out, "06-hipaa-notice.pdf"));
      console.log(`  copied HIPAA notice from ${hipaaPdf.localPath}`);
    } catch (e) {
      await writeFileSafe(
        join(out, "06-hipaa-notice.txt"),
        `HIPAA Notice copy failed: ${(e as Error).message}\nPointer: ${JSON.stringify(HIPAA_NOTICE_POINTER, null, 2)}`,
      );
    }
  } else {
    await writeFileSafe(
      join(out, "06-hipaa-notice.txt"),
      `HIPAA notice metadata (no local PDF on this build):\n${JSON.stringify(HIPAA_NOTICE_POINTER, null, 2)}`,
    );
  }
}

async function copySourceFiles(out: string, repoRoot: string): Promise<void> {
  const srcDir = join(repoRoot, "docs", "legal");
  const dstDir = join(out, "07-source-files");
  await mkdir(dstDir, { recursive: true });
  const { readdir } = await import("node:fs/promises");
  for (const name of await readdir(srcDir)) {
    if (!name.endsWith(".md")) continue;
    const buf = await readFile(join(srcDir, name));
    await writeFileSafe(join(dstDir, name), buf);
  }
}

async function dumpRuntimeConstants(out: string): Promise<void> {
  const json = {
    LEGAL_COPY_VERSION,
    LEGAL_COPY_STATUS,
    LEGAL_COPY_LAST_REVIEWED_AT,
    LEGAL_COPY_EFFECTIVE_DATE,
    LEGAL_CONTACTS,
    ATTESTATION: {
      heading: ATTESTATION_HEADING,
      lead: ATTESTATION_LEAD,
      questions: ATTESTATION_QUESTIONS,
      signatureDisclaimer: ATTESTATION_SIGNATURE_DISCLAIMER,
      confirmationHeading: ATTESTATION_CONFIRMATION_HEADING,
      confirmationBody: ATTESTATION_CONFIRMATION_BODY,
    },
    PRIVACY_NOTICE,
    TERMS_OF_SERVICE,
    COOKIE_NOTICE,
    HIPAA_NOTICE_POINTER,
    PRIVACY_NOTICE_SUMMARY,
    TERMS_OF_SERVICE_SUMMARY,
    COOKIE_NOTICE_SUMMARY,
  };
  await writeFileSafe(join(out, "08-runtime-constants.json"), JSON.stringify(json, null, 2));
}

async function dumpAcknowledgements(out: string, includeAcks: boolean): Promise<void> {
  if (!includeAcks) {
    await writeFileSafe(
      join(out, "09-attestation-acknowledgements.csv"),
      "version,acknowledgement_count,note\n" +
        `${LEGAL_COPY_VERSION},0,"--include-acks not passed; re-run with the flag and a valid DATABASE_URL to populate"\n`,
    );
    return;
  }
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.auditLog.findMany({
        where: { action: { contains: "attestation" } },
        select: { id: true, providerId: true, action: true, afterState: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      });
      const csv = ["id,providerId,action,timestamp,legalCopyVersion"];
      for (const r of rows) {
        const after = (r.afterState ?? {}) as Record<string, unknown>;
        const ver = (after.legalCopyVersion as string | undefined) ?? "(unknown)";
        csv.push(`${r.id},${r.providerId ?? ""},${r.action},${r.timestamp.toISOString()},${ver}`);
      }
      await writeFileSafe(join(out, "09-attestation-acknowledgements.csv"), csv.join("\n"));
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    await writeFileSafe(
      join(out, "09-attestation-acknowledgements.csv"),
      `# acknowledgement query failed: ${(e as Error).message}\n`,
    );
  }
}

async function buildChecklist(out: string): Promise<void> {
  const md = `# Legal Sign-Off Checklist — \`${LEGAL_COPY_VERSION}\`

Tick **YES** or **NO** for each item. Reply to ${LEGAL_CONTACTS.privacyOfficer}
with the marked-up checklist. Approval is binary at the bundle level —
we don't ship a partial bundle.

| # | Item | YES | NO |
|---|---|:---:|:---:|
| 1 | Privacy Notice (\`03-privacy-notice.md\`) is approved as written. | [ ] | [ ] |
| 2 | Terms of Service (\`04-terms-of-service.md\`) is approved as written. | [ ] | [ ] |
| 3 | Cookie Notice (\`05-cookie-notice.md\`) is approved as written. | [ ] | [ ] |
| 4 | HIPAA Notice pointer (\`06-hipaa-notice.*\`) points to the correct canonical PDF. | [ ] | [ ] |
| 5 | Attestation questions (\`02-attestation-questions.md\`) are accurate, complete, and enforceable. | [ ] | [ ] |
| 6 | Signature disclaimer language ("${ATTESTATION_SIGNATURE_DISCLAIMER}") is accepted. | [ ] | [ ] |
| 7 | Bundle may move from \`DRAFT\` to \`APPROVED\` and become legally binding on providers as of the chosen effective date. | [ ] | [ ] |

**Effective date you authorize (write below):** \`____-__-__\`

**Approver:** ____________________
**Date:** ____________________
**Signature:** ____________________

---

If you marked any item NO, please attach the proposed redline. We will
turn it around in one pass and reissue this packet at the next version
(\`v1.0-draft+1\`).
`;
  await writeFileSafe(join(out, "CHECKLIST.md"), md);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(__dirname, "..", "..");
  const versionDir = join(resolve(args.out), LEGAL_COPY_VERSION);
  console.log(`Building legal review packet for version ${LEGAL_COPY_VERSION}`);
  console.log(`Output directory: ${versionDir}`);

  await mkdir(versionDir, { recursive: true });
  await buildCover(versionDir);
  await buildVersions(versionDir);
  await buildAttestation(versionDir);
  await buildLegalDocs(versionDir);
  await copySourceFiles(versionDir, repoRoot);
  await dumpRuntimeConstants(versionDir);
  await dumpAcknowledgements(versionDir, args.includeAcks);
  await buildChecklist(versionDir);

  console.log(`\nDone. Send the contents of ${versionDir} to ${LEGAL_CONTACTS.privacyOfficer}.`);
  return 0;
}

main()
  .then((rc) => process.exit(rc))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
