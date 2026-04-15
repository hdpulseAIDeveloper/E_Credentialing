/**
 * Roster file generation for delegated and facility enrollments.
 * Produces CSV files compatible with payer submission requirements.
 */

import { db } from "@/server/db";

export interface RosterRow {
  providerLastName: string;
  providerFirstName: string;
  providerMiddleName: string;
  npi: string;
  taxId: string;
  providerType: string;
  specialty: string;
  licenseState: string;
  licenseNumber: string;
  deaNumber: string;
  effectiveDate: string;
  terminationDate: string;
  groupNpi: string;
  groupTaxId: string;
  locationName: string;
  locationAddress: string;
  locationCity: string;
  locationState: string;
  locationZip: string;
}

const CSV_HEADERS = [
  "Provider Last Name",
  "Provider First Name",
  "Provider Middle Name",
  "NPI",
  "Tax ID",
  "Provider Type",
  "Specialty",
  "License State",
  "License Number",
  "DEA Number",
  "Effective Date",
  "Termination Date",
  "Group NPI",
  "Group Tax ID",
  "Location Name",
  "Location Address",
  "Location City",
  "Location State",
  "Location ZIP",
];

const GROUP_NPI = process.env.ESSEN_GROUP_NPI ?? "1234567890";
const GROUP_TAX_ID = process.env.ESSEN_GROUP_TAX_ID ?? "XX-XXXXXXX";

export async function generateDelegatedRoster(enrollmentIds: string[]): Promise<{ csv: string; filename: string; rowCount: number }> {
  const enrollments = await db.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    include: {
      provider: {
        include: {
          providerType: true,
          profile: true,
          licenses: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });

  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const enrollment of enrollments) {
    const p = enrollment.provider;
    const license = p.licenses[0];
    const row = [
      quote(p.legalLastName),
      quote(p.legalFirstName),
      quote(p.legalMiddleName ?? ""),
      quote(p.npi ?? ""),
      quote(""),
      quote(p.providerType.abbreviation),
      quote(p.profile?.specialtyPrimary ?? ""),
      quote(license?.state ?? ""),
      quote(license?.licenseNumber ?? ""),
      quote(p.deaNumber ?? ""),
      quote(enrollment.effectiveDate?.toISOString().split("T")[0] ?? ""),
      quote(""),
      quote(GROUP_NPI),
      quote(GROUP_TAX_ID),
      quote(p.profile?.facilityAssignment ?? ""),
      quote(""),
      quote(""),
      quote("NY"),
      quote(""),
    ];
    rows.push(row.join(","));
  }

  const payerName = enrollments[0]?.payerName ?? "unknown";
  const dateStr = new Date().toISOString().split("T")[0]!.replace(/-/g, "");
  const filename = `Essen_Roster_${payerName.replace(/\s+/g, "_")}_${dateStr}.csv`;

  return { csv: rows.join("\n"), filename, rowCount: enrollments.length };
}

export async function generateFacilityRoster(enrollmentIds: string[]): Promise<{ csv: string; filename: string; rowCount: number }> {
  return generateDelegatedRoster(enrollmentIds);
}

function quote(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
