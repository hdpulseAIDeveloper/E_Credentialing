/**
 * iCIMS HRIS integration — pulls provider demographics at onboarding.
 * Stub returns mock data when ICIMS_API_URL is not set.
 */

const ICIMS_API_URL = process.env.ICIMS_API_URL;
const ICIMS_API_KEY = process.env.ICIMS_API_KEY;

export interface IcimsProviderData {
  icimsId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  npi?: string;
  hireDate?: string;
  facility?: string;
  department?: string;
  jobTitle?: string;
  specialty?: string;
}

export async function fetchProviderFromIcims(icimsId: string): Promise<IcimsProviderData> {
  if (!ICIMS_API_URL) {
    console.warn("[iCIMS] ICIMS_API_URL not set — returning mock data");
    return {
      icimsId,
      firstName: "Demo",
      lastName: "Provider",
      email: "demo.provider@example.com",
      phone: "(917) 555-0100",
      hireDate: new Date().toISOString().split("T")[0],
      facility: "Essen Main – Bronx",
      department: "Behavioral Health",
      jobTitle: "Staff Physician",
      specialty: "Internal Medicine",
    };
  }

  const response = await fetch(`${ICIMS_API_URL}/api/v1/people/${icimsId}`, {
    headers: {
      Authorization: `Bearer ${ICIMS_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`iCIMS API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    icimsId,
    firstName: data.firstname ?? data.first_name ?? "",
    lastName: data.lastname ?? data.last_name ?? "",
    middleName: data.middlename ?? data.middle_name,
    email: data.email ?? "",
    phone: data.phone ?? data.mobile,
    dateOfBirth: data.date_of_birth,
    npi: data.npi,
    hireDate: data.hire_date ?? data.start_date,
    facility: data.location ?? data.facility,
    department: data.department,
    jobTitle: data.job_title ?? data.position,
    specialty: data.specialty,
  };
}

export async function searchIcimsProviders(query: string): Promise<IcimsProviderData[]> {
  if (!ICIMS_API_URL) {
    console.warn("[iCIMS] ICIMS_API_URL not set — returning mock search results");
    return [
      { icimsId: "IC-001", firstName: "James", lastName: "Harrison", email: "james.harrison@example.com", facility: "Essen Main – Bronx" },
      { icimsId: "IC-002", firstName: "Maria", lastName: "Santos", email: "maria.santos@example.com", facility: "Essen – Yonkers" },
    ];
  }

  const response = await fetch(`${ICIMS_API_URL}/api/v1/people?search=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${ICIMS_API_KEY}`, "Content-Type": "application/json" },
  });

  if (!response.ok) throw new Error(`iCIMS search error: ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).map((r: Record<string, string>) => ({
    icimsId: r.id,
    firstName: r.firstname ?? r.first_name ?? "",
    lastName: r.lastname ?? r.last_name ?? "",
    email: r.email ?? "",
    facility: r.location ?? r.facility,
  }));
}
