/**
 * CAQH ProView API integration — pull/push provider data.
 *
 * 2026 alignment (P1 Gap #14):
 *   • Active-site enforcement — surface whether Essen is listed as an
 *     ACTIVE practice location on the provider's CAQH profile (not merely
 *     a "viewer"). CAQH 2026 rules require active-site designation for the
 *     org to receive timely change notifications.
 *   • 120-day re-attestation tracking — derive `nextReattestDue` from
 *     `attestationDate + 120 days` so we can fire reminders at 30/14/3 days.
 *   • Groups module — surface group affiliations so credentialing staff
 *     can verify the correct group is selected during onboarding and
 *     recredentialing.
 *
 * Stub returns mock data when CAQH_API_URL is not set.
 */

const CAQH_API_URL = process.env.CAQH_API_URL;
const CAQH_USERNAME = process.env.CAQH_USERNAME;
const CAQH_PASSWORD = process.env.CAQH_PASSWORD;
const CAQH_ORG_ID = process.env.CAQH_ORG_ID;

// CAQH ProView 2026: 120-day re-attestation cycle.
export const CAQH_REATTEST_CYCLE_DAYS = 120;

export interface CaqhGroupAffiliation {
  groupId: string;
  groupName: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE" | string;
  effectiveDate?: string;
  endDate?: string | null;
  isEssenGroup?: boolean;
}

export interface CaqhPracticeLocation {
  locationId?: string;
  organizationName?: string;
  isActive?: boolean;
  designation?: "PRIMARY" | "SECONDARY" | "ADMIN" | "VIEWER" | string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface CaqhProviderData {
  caqhId: string;
  firstName: string;
  lastName: string;
  npi?: string;
  dateOfBirth?: string;
  ssn?: string;
  email?: string;
  phone?: string;
  addresses?: Array<{ type: string; street: string; city: string; state: string; zip: string }>;
  licenses?: Array<{ state: string; number: string; type: string; expirationDate: string; status: string }>;
  education?: Array<{ school: string; degree: string; graduationDate: string }>;
  boardCertifications?: Array<{ board: string; specialty: string; certDate: string; expirationDate?: string }>;
  attestationDate?: string;
  profileStatus?: string;
  // 2026 additions
  practiceLocations?: CaqhPracticeLocation[];
  groupAffiliations?: CaqhGroupAffiliation[];
  essenIsActiveSite?: boolean;
  nextReattestDue?: string;
}

/**
 * Compute the next CAQH re-attestation due date from a profile's most
 * recent attestation. Returns null if no attestation date is available.
 */
export function computeNextReattestDue(
  attestationDate: string | Date | null | undefined
): Date | null {
  if (!attestationDate) return null;
  const d = attestationDate instanceof Date
    ? attestationDate
    : new Date(attestationDate);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(d);
  next.setDate(next.getDate() + CAQH_REATTEST_CYCLE_DAYS);
  return next;
}

/**
 * Determine whether Essen is an active practice location on the profile.
 * "Active" means a non-VIEWER designation with isActive=true.
 */
export function detectEssenActiveSite(
  locations: CaqhPracticeLocation[] | undefined,
  essenOrgNamePatterns: RegExp[] = [/essen/i]
): boolean {
  if (!locations || locations.length === 0) return false;
  return locations.some((loc) => {
    const name = loc.organizationName ?? "";
    const matchesEssen = essenOrgNamePatterns.some((p) => p.test(name));
    if (!matchesEssen) return false;
    const isViewer = (loc.designation ?? "").toUpperCase() === "VIEWER";
    return Boolean(loc.isActive) && !isViewer;
  });
}

function authHeader(): Record<string, string> {
  const token = Buffer.from(`${CAQH_USERNAME}:${CAQH_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${token}`, "Content-Type": "application/json" };
}

export async function pullProviderData(caqhId: string): Promise<CaqhProviderData> {
  if (!CAQH_API_URL) {
    console.warn("[CAQH] CAQH_API_URL not set — returning mock data");
    const today = new Date();
    const lastAttest = new Date(today);
    lastAttest.setDate(today.getDate() - 90); // mock: attested 90 days ago
    const locations: CaqhPracticeLocation[] = [
      {
        organizationName: "Essen Medical Associates",
        isActive: true,
        designation: "PRIMARY",
        street: "1414 Newkirk Ave",
        city: "Brooklyn",
        state: "NY",
        zip: "11226",
      },
    ];
    const groups: CaqhGroupAffiliation[] = [
      {
        groupId: "ESSEN_PRIMARY_CARE",
        groupName: "Essen Primary Care Group",
        status: "ACTIVE",
        effectiveDate: "2024-01-01",
        isEssenGroup: true,
      },
    ];
    return {
      caqhId,
      firstName: "Demo",
      lastName: "Provider",
      npi: "1234567890",
      email: "demo@example.com",
      profileStatus: "Re-Attested",
      attestationDate: lastAttest.toISOString(),
      nextReattestDue: computeNextReattestDue(lastAttest)?.toISOString(),
      licenses: [{ state: "NY", number: "LIC-12345", type: "Physician and Surgeon", expirationDate: "2027-12-31", status: "Active" }],
      education: [{ school: "Demo Medical School", degree: "MD", graduationDate: "2015-05-15" }],
      boardCertifications: [{ board: "ABIM", specialty: "Internal Medicine", certDate: "2018-01-01" }],
      practiceLocations: locations,
      groupAffiliations: groups,
      essenIsActiveSite: detectEssenActiveSite(locations),
    };
  }

  const response = await fetch(`${CAQH_API_URL}/api/v1/providers/${caqhId}?organizationId=${CAQH_ORG_ID}`, {
    headers: authHeader(),
  });

  if (!response.ok) throw new Error(`CAQH API error: ${response.status} ${response.statusText}`);
  const data = await response.json();

  const practiceLocations: CaqhPracticeLocation[] | undefined = data.practice_locations;
  const groupAffiliations: CaqhGroupAffiliation[] | undefined = data.group_affiliations;

  return {
    caqhId,
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    npi: data.npi,
    dateOfBirth: data.date_of_birth,
    email: data.email,
    phone: data.phone,
    addresses: data.addresses,
    licenses: data.licenses,
    education: data.education,
    boardCertifications: data.board_certifications,
    attestationDate: data.attestation_date,
    profileStatus: data.profile_status,
    practiceLocations,
    groupAffiliations,
    essenIsActiveSite: detectEssenActiveSite(practiceLocations),
    nextReattestDue: computeNextReattestDue(data.attestation_date)?.toISOString(),
  };
}

export async function pushProviderAttestation(caqhId: string, attestationData: {
  providerName: string;
  attestationDate: string;
  npi: string;
}): Promise<{ success: boolean; message: string }> {
  if (!CAQH_API_URL) {
    console.warn("[CAQH] CAQH_API_URL not set — stubbing attestation push");
    return { success: true, message: "Stub: Attestation push simulated" };
  }

  const response = await fetch(`${CAQH_API_URL}/api/v1/providers/${caqhId}/attestation`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ ...attestationData, organizationId: CAQH_ORG_ID }),
  });

  if (!response.ok) throw new Error(`CAQH attestation push error: ${response.status}`);
  return { success: true, message: "Attestation pushed to CAQH" };
}

export async function getCaqhRosterStatus(caqhId: string): Promise<string> {
  if (!CAQH_API_URL) return "MOCK_ACTIVE";
  const response = await fetch(`${CAQH_API_URL}/api/v1/providers/${caqhId}/roster?organizationId=${CAQH_ORG_ID}`, { headers: authHeader() });
  if (!response.ok) return "UNKNOWN";
  const data = await response.json();
  return data.roster_status ?? "UNKNOWN";
}
