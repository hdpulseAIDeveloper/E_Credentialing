/**
 * P1 Gap #10 — Audit-ready credentialing packet generator.
 *
 * Builds a single ZIP per provider that contains everything a delegated
 * credentialing audit (NCQA CR, payer delegation review, Joint Commission
 * site survey) typically asks for. Designed so a credentialing analyst can
 * hand the ZIP to an auditor without further preparation.
 *
 * Packet layout:
 *   manifest.json
 *   00-cover-sheet.txt
 *   01-application/application-summary.txt
 *   02-licenses/{state}-license.{ext}        (latest per state)
 *   03-dea/dea-verification.{ext}            (latest)
 *   04-boards/{board}-certification.{ext}
 *   05-sanctions/oig-{date}.{ext}, sam-{date}.{ext}
 *   06-npdb/npdb-report.{ext}                (or NPDB_NOT_QUERIED.txt)
 *   07-work-history/{employer}.txt
 *   08-references/{name}.txt
 *   09-attestations/attestation.txt
 *   10-monitoring-alerts/alerts.csv
 *   11-audit-trail/audit-log.csv
 */

import JSZip from "jszip";
import { downloadDocument } from "./azure/blob";
import type { PrismaClient } from "@prisma/client";

interface ManifestSection {
  folder: string;
  description: string;
  fileCount: number;
  sources: string[];
}

interface PacketResult {
  zipBuffer: Buffer;
  fileName: string;
  manifest: {
    providerId: string;
    providerName: string;
    npi: string | null;
    generatedAt: string;
    sections: ManifestSection[];
    totalFiles: number;
  };
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

async function tryDownload(
  blobPath: string | null | undefined
): Promise<Buffer | null> {
  if (!blobPath) return null;
  try {
    return await downloadDocument(blobPath);
  } catch (err) {
    console.warn(`[AuditPacket] Failed to download ${blobPath}:`, err);
    return null;
  }
}

export async function generateAuditPacket(
  db: PrismaClient,
  providerId: string
): Promise<PacketResult> {
  const provider = await db.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      providerType: true,
      profile: true,
      licenses: true,
      assignedSpecialist: { select: { displayName: true, email: true } },
    },
  });

  const [
    documents,
    verificationRecords,
    sanctionsChecks,
    npdbRecords,
    workHistory,
    references,
    monitoringAlerts,
    auditLogs,
  ] = await Promise.all([
    db.document.findMany({
      where: { providerId, isDeleted: false },
      orderBy: { createdAt: "desc" },
    }),
    db.verificationRecord.findMany({
      where: { providerId },
      orderBy: { verifiedDate: "desc" },
    }),
    db.sanctionsCheck.findMany({
      where: { providerId },
      orderBy: { runDate: "desc" },
    }),
    db.nPDBRecord.findMany({
      where: { providerId },
      orderBy: { queryDate: "desc" },
    }),
    db.workHistoryVerification.findMany({
      where: { providerId },
      orderBy: { startDate: "desc" },
    }),
    db.professionalReference.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
    }),
    db.monitoringAlert.findMany({
      where: { providerId },
      orderBy: { detectedAt: "desc" },
    }),
    db.auditLog.findMany({
      where: { providerId },
      orderBy: { timestamp: "desc" },
      take: 1000,
      include: {
        actor: { select: { displayName: true, email: true } },
      },
    }),
  ]);

  const zip = new JSZip();
  const sections: ManifestSection[] = [];

  // ── 00 cover sheet ───────────────────────────────────────────────────
  const providerName = `${provider.legalLastName}, ${provider.legalFirstName}`;
  const generatedAt = new Date();

  const coverSheet = [
    "ESSEN CREDENTIALING — DELEGATED AUDIT PACKET",
    `Generated: ${generatedAt.toISOString()}`,
    "",
    `Provider: ${providerName}`,
    `Provider type: ${provider.providerType?.name ?? "—"}`,
    `NPI: ${provider.npi ?? "—"}`,
    `Status: ${provider.status}`,
    `Application submitted: ${fmtDate(provider.applicationSubmittedAt)}`,
    `Initially approved: ${fmtDate(provider.initialApprovalDate ?? provider.approvedAt)}`,
    `Most recent approval: ${fmtDate(provider.approvedAt)}`,
    `Assigned specialist: ${provider.assignedSpecialist?.displayName ?? "—"}`,
    "",
    "PACKET CONTENTS:",
    "  00-cover-sheet.txt              this file",
    "  01-application/                 application snapshot",
    "  02-licenses/                    state license verifications",
    "  03-dea/                         DEA verification",
    "  04-boards/                      board certifications",
    "  05-sanctions/                   OIG, SAM.gov, state Medicaid",
    "  06-npdb/                        NPDB Continuous Query reports",
    "  07-work-history/                employer verifications",
    "  08-references/                  professional references",
    "  09-attestations/                provider attestations",
    "  10-monitoring-alerts/           continuous monitoring alerts",
    "  11-audit-trail/                 actor-keyed audit log",
    "",
    "All credentials below are documented per NCQA CR standards (PSV ≤90 days",
    "for initial credentialing, ≤120 days for recredentialing) and federal/state",
    "exclusion screening per NCQA 2026 30-day continuous monitoring.",
  ].join("\n");

  zip.file("00-cover-sheet.txt", coverSheet);

  // ── 01 application snapshot ──────────────────────────────────────────
  const applicationSummary = [
    "PROVIDER APPLICATION SNAPSHOT",
    "",
    `Legal name: ${provider.legalFirstName} ${provider.legalMiddleName ?? ""} ${provider.legalLastName}`.trim(),
    `Personal email: ${provider.profile?.personalEmail ?? "—"}`,
    `Mobile phone: ${provider.profile?.mobilePhone ?? "—"}`,
    `Date of birth (encrypted): ${provider.dateOfBirth ?? "—"}`,
    `Race: ${provider.profile?.race ?? "—"}`,
    `Ethnicity: ${provider.profile?.ethnicity ?? "—"}`,
    `Languages: ${(provider.languagesSpoken ?? []).join(", ") || "—"}`,
    `CAQH ID: ${provider.caqhId ?? "—"}`,
    `iCIMS ID: ${provider.icimsId ?? "—"}`,
    "",
    "Non-discrimination disclosure acknowledgment:",
    `  Acknowledged at: ${fmtDate(provider.profile?.nonDiscriminationAckAt)}`,
    `  Disclosure version: ${provider.profile?.nonDiscriminationAckVersion ?? "—"}`,
  ].join("\n");
  zip.folder("01-application")?.file("application-summary.txt", applicationSummary);
  sections.push({
    folder: "01-application",
    description: "Provider application snapshot",
    fileCount: 1,
    sources: ["Provider", "ProviderProfile"],
  });

  // ── 02 licenses ──────────────────────────────────────────────────────
  const licenseFolder = zip.folder("02-licenses");
  let licenseCount = 0;
  const licenseSources = new Set<string>();
  for (const license of provider.licenses) {
    const latest = verificationRecords.find(
      (v) =>
        v.credentialType === "LICENSE" &&
        ((v.resultDetails as Record<string, unknown> | null)?.licenseId ===
          license.id ||
          (v.resultDetails as Record<string, unknown> | null)?.state ===
            license.state)
    );

    const summary = [
      `STATE: ${license.state}`,
      `LICENSE NUMBER: ${license.licenseNumber}`,
      `STATUS: ${license.status}`,
      `ISSUED: ${fmtDate(license.issueDate)}`,
      `EXPIRES: ${fmtDate(license.expirationDate)}`,
      `IS PRIMARY: ${license.isPrimary}`,
      "",
      latest
        ? `Latest verification: ${latest.verifiedDate.toISOString()} from ${latest.sourceWebsite}`
        : "Latest verification: NONE ON RECORD",
    ].join("\n");

    licenseFolder?.file(`${safeName(license.state)}-license-summary.txt`, summary);
    licenseCount += 1;
    licenseSources.add(latest?.sourceWebsite ?? "manual");

    if (latest?.pdfBlobUrl) {
      const pdf = await tryDownload(blobPathFromUrl(latest.pdfBlobUrl));
      if (pdf) {
        licenseFolder?.file(
          `${safeName(license.state)}-license-verification.pdf`,
          pdf
        );
        licenseCount += 1;
      }
    }
  }
  sections.push({
    folder: "02-licenses",
    description: "State license verifications",
    fileCount: licenseCount,
    sources: Array.from(licenseSources),
  });

  // ── 03 DEA ──────────────────────────────────────────────────────────
  const deaFolder = zip.folder("03-dea");
  const latestDea = verificationRecords.find((v) => v.credentialType === "DEA");
  if (latestDea) {
    deaFolder?.file(
      "dea-verification-summary.txt",
      [
        `DEA verification`,
        `Verified at: ${latestDea.verifiedDate.toISOString()}`,
        `Source: ${latestDea.sourceWebsite}`,
        `Status: ${latestDea.status}`,
        `Flagged: ${latestDea.isFlagged}${latestDea.flagReason ? ` (${latestDea.flagReason})` : ""}`,
      ].join("\n")
    );
    if (latestDea.pdfBlobUrl) {
      const pdf = await tryDownload(blobPathFromUrl(latestDea.pdfBlobUrl));
      if (pdf) deaFolder?.file("dea-verification.pdf", pdf);
    }
  } else {
    deaFolder?.file(
      "DEA_NOT_APPLICABLE.txt",
      "No DEA verification on file. Confirm whether this provider prescribes controlled substances."
    );
  }
  sections.push({
    folder: "03-dea",
    description: "DEA verification",
    fileCount: 1,
    sources: latestDea ? [latestDea.sourceWebsite] : [],
  });

  // ── 04 boards ───────────────────────────────────────────────────────
  const boardFolder = zip.folder("04-boards");
  const boardRecords = verificationRecords.filter(
    (v) =>
      v.credentialType === "BOARD_NCCPA" ||
      v.credentialType === "BOARD_ABIM" ||
      v.credentialType === "BOARD_ABFM" ||
      v.credentialType === "BOARD_OTHER"
  );
  if (boardRecords.length === 0) {
    boardFolder?.file(
      "NO_BOARD_CERT_ON_FILE.txt",
      "No board certification verifications on file."
    );
  } else {
    for (const v of boardRecords) {
      const label = `${v.sourceWebsite.replace(/https?:\/\//, "").split("/")[0]}_${fmtDate(v.verifiedDate)}`;
      boardFolder?.file(
        `${safeName(label)}.txt`,
        JSON.stringify(v.resultDetails, null, 2)
      );
      if (v.pdfBlobUrl) {
        const pdf = await tryDownload(blobPathFromUrl(v.pdfBlobUrl));
        if (pdf) boardFolder?.file(`${safeName(label)}.pdf`, pdf);
      }
    }
  }
  sections.push({
    folder: "04-boards",
    description: "Board certifications",
    fileCount: boardRecords.length,
    sources: Array.from(new Set(boardRecords.map((v) => v.sourceWebsite))),
  });

  // ── 05 sanctions ────────────────────────────────────────────────────
  const sanctionsFolder = zip.folder("05-sanctions");
  for (const check of sanctionsChecks) {
    const stem = `${check.source.toLowerCase()}-${fmtDate(check.runDate)}`;
    sanctionsFolder?.file(
      `${safeName(stem)}.txt`,
      [
        `Source: ${check.source}`,
        `Run date: ${check.runDate.toISOString()}`,
        `Result: ${check.result}`,
        `Triggered by: ${check.triggeredBy}`,
        `Exclusion type: ${check.exclusionType ?? "—"}`,
        `Exclusion effective date: ${fmtDate(check.exclusionEffectiveDate)}`,
        `Exclusion basis: ${check.exclusionBasis ?? "—"}`,
        `Acknowledged: ${check.isAcknowledged ? "yes" : "no"}`,
      ].join("\n")
    );
  }
  sections.push({
    folder: "05-sanctions",
    description: "Sanctions checks (OIG, SAM, state Medicaid)",
    fileCount: sanctionsChecks.length,
    sources: Array.from(new Set(sanctionsChecks.map((c) => c.source))),
  });

  // ── 06 NPDB ─────────────────────────────────────────────────────────
  const npdbFolder = zip.folder("06-npdb");
  if (npdbRecords.length === 0) {
    npdbFolder?.file(
      "NPDB_NOT_QUERIED.txt",
      "No NPDB record on file. Either the NPDB Continuous Query has not yet " +
        "been run for this provider OR the NPDB integration is currently in " +
        "manual mode (see docs/workflows/npdb-manual.md)."
    );
  } else {
    for (const r of npdbRecords) {
      npdbFolder?.file(
        `npdb-${fmtDate(r.queryDate)}-summary.txt`,
        [
          `NPDB query ${r.queryDate.toISOString()}`,
          `Type: ${r.queryType}`,
          `Result: ${r.result}`,
          `Report count: ${r.reportCount}`,
          `Continuous Query enrolled: ${r.continuousQueryEnrolled}`,
          `Confirmation #: ${r.queryConfirmationNumber ?? "—"}`,
        ].join("\n")
      );
      if (r.reportBlobUrl) {
        const pdf = await tryDownload(blobPathFromUrl(r.reportBlobUrl));
        if (pdf) npdbFolder?.file(`npdb-${fmtDate(r.queryDate)}.pdf`, pdf);
      }
    }
  }
  sections.push({
    folder: "06-npdb",
    description: "NPDB queries",
    fileCount: npdbRecords.length,
    sources: ["npdb.hrsa.gov"],
  });

  // ── 07 work history ─────────────────────────────────────────────────
  const whFolder = zip.folder("07-work-history");
  for (const w of workHistory) {
    const label = `${safeName(w.employerName)}_${fmtDate(w.startDate)}`;
    whFolder?.file(
      `${label}.txt`,
      [
        `Employer: ${w.employerName}`,
        `Contact: ${w.contactName ?? "—"}`,
        `Position: ${w.position ?? "—"}`,
        `Start: ${fmtDate(w.startDate)}`,
        `End: ${fmtDate(w.endDate)}`,
        `Status: ${w.status}`,
        `Sent at: ${fmtDate(w.requestSentAt)}`,
        `Received at: ${fmtDate(w.receivedAt)}`,
        `Verified by: ${w.verifiedBy ?? "—"}`,
        `Notes: ${w.notes ?? "—"}`,
      ].join("\n")
    );
  }
  sections.push({
    folder: "07-work-history",
    description: "Employer verifications",
    fileCount: workHistory.length,
    sources: ["email"],
  });

  // ── 08 references ───────────────────────────────────────────────────
  const refFolder = zip.folder("08-references");
  for (const r of references) {
    const label = `${safeName(r.referenceName)}_${fmtDate(r.createdAt)}`;
    refFolder?.file(
      `${label}.txt`,
      [
        `Reference: ${r.referenceName}`,
        `Title: ${r.referenceTitle ?? "—"}`,
        `Email: ${r.referenceEmail}`,
        `Relationship: ${r.relationship ?? "—"}`,
        `Status: ${r.status}`,
        `Sent at: ${fmtDate(r.requestSentAt)}`,
        `Received at: ${fmtDate(r.receivedAt)}`,
      ].join("\n")
    );
  }
  sections.push({
    folder: "08-references",
    description: "Professional references",
    fileCount: references.length,
    sources: ["email"],
  });

  // ── 09 attestations ─────────────────────────────────────────────────
  const attFolder = zip.folder("09-attestations");
  attFolder?.file(
    "attestation-summary.txt",
    [
      `Application started: ${fmtDate(provider.applicationStartedAt)}`,
      `Application submitted: ${fmtDate(provider.applicationSubmittedAt)}`,
      `Non-discrimination disclosure acknowledged at: ${fmtDate(provider.profile?.nonDiscriminationAckAt)}`,
      `Non-discrimination disclosure version: ${provider.profile?.nonDiscriminationAckVersion ?? "—"}`,
    ].join("\n")
  );
  sections.push({
    folder: "09-attestations",
    description: "Provider attestations",
    fileCount: 1,
    sources: ["self-service portal"],
  });

  // ── 10 monitoring alerts ────────────────────────────────────────────
  const alertCsvHeader =
    "detectedAt,severity,status,type,source,title,description,resolutionNotes\n";
  const alertCsvRows = monitoringAlerts.map((a) =>
    [
      a.detectedAt.toISOString(),
      a.severity,
      a.status,
      a.type,
      a.source,
      JSON.stringify(a.title),
      JSON.stringify(a.description),
      JSON.stringify(a.resolutionNotes ?? ""),
    ].join(",")
  );
  zip
    .folder("10-monitoring-alerts")
    ?.file("alerts.csv", alertCsvHeader + alertCsvRows.join("\n"));
  sections.push({
    folder: "10-monitoring-alerts",
    description: "Continuous monitoring alerts (P1 Gap #9)",
    fileCount: 1,
    sources: ["MonitoringAlert"],
  });

  // ── 11 audit trail ──────────────────────────────────────────────────
  const auditCsvHeader =
    "timestamp,actor,actorRole,action,entityType,entityId,metadata\n";
  const auditCsvRows = auditLogs.map((log) =>
    [
      log.timestamp.toISOString(),
      JSON.stringify(log.actor?.displayName ?? "SYSTEM"),
      log.actorRole ?? "",
      log.action,
      log.entityType,
      log.entityId,
      JSON.stringify(log.metadata ?? log.afterState ?? ""),
    ].join(",")
  );
  zip
    .folder("11-audit-trail")
    ?.file("audit-log.csv", auditCsvHeader + auditCsvRows.join("\n"));
  sections.push({
    folder: "11-audit-trail",
    description: "Actor-keyed audit log",
    fileCount: 1,
    sources: ["AuditLog"],
  });

  // ── manifest.json ───────────────────────────────────────────────────
  const totalFiles = sections.reduce((s, x) => s + x.fileCount, 0);
  const manifest = {
    providerId: provider.id,
    providerName,
    npi: provider.npi,
    generatedAt: generatedAt.toISOString(),
    sections,
    totalFiles,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Also include the documents folder as-is so any "uploaded" file the
  // auditor might want to see is present (e.g., diplomas, CVs, malpractice
  // declarations). We include the most recent of each documentType.
  const documentsByType = new Map<string, (typeof documents)[number]>();
  for (const doc of documents) {
    if (!documentsByType.has(doc.documentType)) {
      documentsByType.set(doc.documentType, doc);
    }
  }
  const docsFolder = zip.folder("99-documents");
  let extraDocs = 0;
  for (const [type, doc] of documentsByType) {
    const blob = await tryDownload(doc.blobPath);
    if (blob) {
      const ext = inferExt(doc.mimeType, doc.originalFilename);
      docsFolder?.file(`${safeName(type)}-${doc.id.slice(0, 8)}.${ext}`, blob);
      extraDocs += 1;
    }
  }
  sections.push({
    folder: "99-documents",
    description: "Most recent uploaded document per type",
    fileCount: extraDocs,
    sources: ["Document blob"],
  });

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const fileName = `${safeName(provider.legalLastName)}-${safeName(provider.legalFirstName)}-audit-packet-${fmtDate(generatedAt)}.zip`;

  return {
    zipBuffer,
    fileName,
    manifest: { ...manifest, totalFiles: totalFiles + extraDocs },
  };
}

function inferExt(mimeType: string, filename: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/tiff": "tif",
  };
  if (map[mimeType]) return map[mimeType];
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).slice(0, 6) : "bin";
}

function blobPathFromUrl(blobUrl: string): string {
  // Azure blob URLs are like https://account.blob.core.windows.net/container/path/to/blob
  // Extract the part after "/{container}/" so downloadDocument can use it.
  try {
    const u = new URL(blobUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    // parts[0] is the container; rest is the blob path
    return parts.slice(1).join("/");
  } catch {
    return blobUrl;
  }
}

export type { PacketResult };
