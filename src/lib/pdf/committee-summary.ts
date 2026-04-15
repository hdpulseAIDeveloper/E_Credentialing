/**
 * Committee summary sheet PDF generation.
 * Generates a PDF for a single provider containing all verification data
 * for committee review.
 */

import { db } from "@/server/db";

export interface CommitteeSummaryData {
  providerName: string;
  providerType: string;
  npi: string;
  status: string;
  licenses: Array<{ state: string; number: string; type: string; expiration: string; status: string }>;
  verifications: Array<{ type: string; status: string; date: string; source: string; flagged: boolean }>;
  sanctions: Array<{ source: string; date: string; result: string }>;
  npdb: Array<{ date: string; result: string; reportCount: number }>;
  expirables: Array<{ type: string; expiration: string; status: string }>;
  hospitalPrivileges: Array<{ facility: string; type: string; status: string }>;
  applicationDate?: string;
  specialistName?: string;
}

export async function gatherSummaryData(providerId: string): Promise<CommitteeSummaryData> {
  const provider = await db.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      providerType: true,
      assignedSpecialist: { select: { displayName: true } },
      licenses: { orderBy: { isPrimary: "desc" } },
      verificationRecords: { orderBy: { verifiedDate: "desc" } },
      sanctionsChecks: { orderBy: { runDate: "desc" }, take: 5 },
      npdbRecords: { orderBy: { queryDate: "desc" }, take: 3 },
      expirables: { orderBy: { expirationDate: "asc" } },
      hospitalPrivileges: true,
    },
  });

  return {
    providerName: `${provider.legalFirstName} ${provider.legalLastName}`,
    providerType: provider.providerType.name,
    npi: provider.npi ?? "N/A",
    status: provider.status,
    licenses: provider.licenses.map((l) => ({
      state: l.state,
      number: l.licenseNumber,
      type: l.licenseType,
      expiration: l.expirationDate?.toLocaleDateString() ?? "N/A",
      status: l.status,
    })),
    verifications: provider.verificationRecords.map((v) => ({
      type: v.credentialType,
      status: v.status,
      date: v.verifiedDate.toLocaleDateString(),
      source: v.sourceWebsite ?? "",
      flagged: v.isFlagged,
    })),
    sanctions: provider.sanctionsChecks.map((s) => ({
      source: s.source,
      date: s.runDate.toLocaleDateString(),
      result: s.result,
    })),
    npdb: provider.npdbRecords.map((n) => ({
      date: n.queryDate.toLocaleDateString(),
      result: n.result,
      reportCount: n.reportCount,
    })),
    expirables: provider.expirables.map((e) => ({
      type: e.expirableType,
      expiration: e.expirationDate.toLocaleDateString(),
      status: e.status,
    })),
    hospitalPrivileges: provider.hospitalPrivileges.map((h) => ({
      facility: h.facilityName,
      type: h.privilegeType,
      status: h.status,
    })),
    applicationDate: provider.applicationSubmittedAt?.toLocaleDateString(),
    specialistName: provider.assignedSpecialist?.displayName ?? undefined,
  };
}

/**
 * Generates a plain-text committee summary that can be rendered as HTML or stored.
 * In production this would generate a real PDF using jspdf or @react-pdf/renderer.
 */
export async function generateCommitteeSummaryHtml(providerId: string): Promise<string> {
  const data = await gatherSummaryData(providerId);

  const sections: string[] = [];

  sections.push(`<h1>Committee Summary Sheet</h1>`);
  sections.push(`<h2>${data.providerName}</h2>`);
  sections.push(`<p><strong>Provider Type:</strong> ${data.providerType} | <strong>NPI:</strong> ${data.npi} | <strong>Status:</strong> ${data.status}</p>`);
  if (data.applicationDate) sections.push(`<p><strong>Application Submitted:</strong> ${data.applicationDate}</p>`);
  if (data.specialistName) sections.push(`<p><strong>Assigned Specialist:</strong> ${data.specialistName}</p>`);

  // Licenses
  sections.push(`<h3>State Licenses</h3>`);
  if (data.licenses.length === 0) {
    sections.push(`<p>No licenses on file.</p>`);
  } else {
    sections.push(`<table border="1" cellpadding="4"><tr><th>State</th><th>Number</th><th>Type</th><th>Expiration</th><th>Status</th></tr>`);
    for (const l of data.licenses) {
      sections.push(`<tr><td>${l.state}</td><td>${l.number}</td><td>${l.type}</td><td>${l.expiration}</td><td>${l.status}</td></tr>`);
    }
    sections.push(`</table>`);
  }

  // Verifications
  sections.push(`<h3>Primary Source Verifications</h3>`);
  if (data.verifications.length === 0) {
    sections.push(`<p>No verifications completed.</p>`);
  } else {
    sections.push(`<table border="1" cellpadding="4"><tr><th>Credential</th><th>Status</th><th>Date</th><th>Source</th><th>Flagged</th></tr>`);
    for (const v of data.verifications) {
      sections.push(`<tr><td>${v.type}</td><td>${v.status}</td><td>${v.date}</td><td>${v.source}</td><td>${v.flagged ? "YES" : "No"}</td></tr>`);
    }
    sections.push(`</table>`);
  }

  // Sanctions
  sections.push(`<h3>Sanctions Checks</h3>`);
  if (data.sanctions.length === 0) {
    sections.push(`<p>No sanctions checks on file.</p>`);
  } else {
    sections.push(`<table border="1" cellpadding="4"><tr><th>Source</th><th>Date</th><th>Result</th></tr>`);
    for (const s of data.sanctions) {
      sections.push(`<tr><td>${s.source}</td><td>${s.date}</td><td>${s.result}</td></tr>`);
    }
    sections.push(`</table>`);
  }

  // NPDB
  sections.push(`<h3>NPDB Records</h3>`);
  if (data.npdb.length === 0) {
    sections.push(`<p>No NPDB queries on file.</p>`);
  } else {
    sections.push(`<table border="1" cellpadding="4"><tr><th>Date</th><th>Result</th><th>Reports</th></tr>`);
    for (const n of data.npdb) {
      sections.push(`<tr><td>${n.date}</td><td>${n.result}</td><td>${n.reportCount}</td></tr>`);
    }
    sections.push(`</table>`);
  }

  // Hospital Privileges
  if (data.hospitalPrivileges.length > 0) {
    sections.push(`<h3>Hospital Privileges</h3>`);
    sections.push(`<table border="1" cellpadding="4"><tr><th>Facility</th><th>Type</th><th>Status</th></tr>`);
    for (const h of data.hospitalPrivileges) {
      sections.push(`<tr><td>${h.facility}</td><td>${h.type}</td><td>${h.status}</td></tr>`);
    }
    sections.push(`</table>`);
  }

  sections.push(`<hr><p><em>Generated: ${new Date().toLocaleString()}</em></p>`);

  return sections.join("\n");
}
