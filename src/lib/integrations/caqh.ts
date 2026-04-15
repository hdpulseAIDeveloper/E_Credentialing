/**
 * CAQH ProView API integration — pull/push provider data.
 * Stub returns mock data when CAQH_API_URL is not set.
 */

const CAQH_API_URL = process.env.CAQH_API_URL;
const CAQH_USERNAME = process.env.CAQH_USERNAME;
const CAQH_PASSWORD = process.env.CAQH_PASSWORD;
const CAQH_ORG_ID = process.env.CAQH_ORG_ID;

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
}

function authHeader(): Record<string, string> {
  const token = Buffer.from(`${CAQH_USERNAME}:${CAQH_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${token}`, "Content-Type": "application/json" };
}

export async function pullProviderData(caqhId: string): Promise<CaqhProviderData> {
  if (!CAQH_API_URL) {
    console.warn("[CAQH] CAQH_API_URL not set — returning mock data");
    return {
      caqhId,
      firstName: "Demo",
      lastName: "Provider",
      npi: "1234567890",
      email: "demo@example.com",
      profileStatus: "Re-Attested",
      licenses: [{ state: "NY", number: "LIC-12345", type: "Physician and Surgeon", expirationDate: "2027-12-31", status: "Active" }],
      education: [{ school: "Demo Medical School", degree: "MD", graduationDate: "2015-05-15" }],
      boardCertifications: [{ board: "ABIM", specialty: "Internal Medicine", certDate: "2018-01-01" }],
    };
  }

  const response = await fetch(`${CAQH_API_URL}/api/v1/providers/${caqhId}?organizationId=${CAQH_ORG_ID}`, {
    headers: authHeader(),
  });

  if (!response.ok) throw new Error(`CAQH API error: ${response.status} ${response.statusText}`);
  const data = await response.json();

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
