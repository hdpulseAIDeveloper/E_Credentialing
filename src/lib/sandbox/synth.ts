/**
 * Wave 5.2 — deterministic synthetic provider generator for the public
 * sandbox API.
 *
 * Pure module: no DB, no env, no I/O. Same input → same output, every
 * time, in every environment. The values are FAKE — never put a real
 * NPI, license number, or DEA in here.
 *
 * Design notes:
 *   - The synthetic NPI uses 10 digits with a deterministic Luhn-on-NPI
 *     check digit so it shape-matches a real NPI (any FHIR client
 *     that runs a checksum validation will be happy).
 *   - States cycle through a 10-state set so geographic queries return
 *     non-trivial results.
 *   - Status cycles through the realistic credentialing lifecycle so a
 *     dashboard built against the sandbox shows variety.
 */

export interface SandboxProvider {
  id: string;
  name: string;
  npi: string;
  primaryState: string;
  status: SandboxStatus;
  licenses: Array<{ state: string; number: string; expiresOn: string }>;
  boards: Array<{ abmsBoard: string; status: "CERTIFIED" | "ELIGIBLE" }>;
  sanctions: {
    oig: "clear" | "flagged";
    sam: "clear" | "flagged";
    stateMedicaid: "clear" | "flagged";
    lastChecked: string;
  };
  expirables: Array<{ type: string; expiresOn: string }>;
}

export type SandboxStatus =
  | "INVITED"
  | "DOCUMENTS_PENDING"
  | "VERIFICATION_IN_PROGRESS"
  | "COMMITTEE_READY"
  | "APPROVED"
  | "DENIED";

const FIRST_NAMES = [
  "Sarah", "Michael", "Priya", "Jamal", "Elena", "David", "Aisha",
  "Tomas", "Olivia", "Hiroshi", "Maria", "Jonathan", "Aaliyah",
  "Carlos", "Yuki", "Wei", "Liam", "Ada", "Noor", "Marcus",
  "Anika", "Felix", "Sofia", "Raj", "Mei",
];

const LAST_NAMES = [
  "Adler", "Brennan", "Chen", "Diaz", "Elias", "Foster", "Gonzalez",
  "Huang", "Iqbal", "Johnson", "Kapoor", "Lopez", "Mitchell",
  "Nakamura", "Okonkwo", "Patel", "Quinn", "Romero", "Singh",
  "Tanaka", "Underwood", "Vargas", "Wong", "Xu", "Yamada",
];

const DEGREES = ["MD", "DO", "PA-C", "NP", "DDS"];

const STATES = ["NY", "PA", "NJ", "CT", "MA", "FL", "TX", "CA", "IL", "OH"];

const STATUSES: SandboxStatus[] = [
  "INVITED",
  "DOCUMENTS_PENDING",
  "VERIFICATION_IN_PROGRESS",
  "COMMITTEE_READY",
  "APPROVED",
  "APPROVED",
  "APPROVED",
  "DENIED",
];

const ABMS_BOARDS = [
  "American Board of Internal Medicine",
  "American Board of Family Medicine",
  "American Board of Surgery",
  "American Board of Pediatrics",
  "American Board of Psychiatry and Neurology",
];

const COUNT = 25;

/**
 * Returns the full deterministic synthetic provider list.
 */
export function synthProviders(): SandboxProvider[] {
  return Array.from({ length: COUNT }, (_, i) => buildProvider(i + 1));
}

export function synthProviderById(id: string): SandboxProvider | null {
  const m = /^sandbox-(\d+)$/.exec(id);
  if (!m) return null;
  const idx = Number(m[1]);
  if (!Number.isInteger(idx) || idx < 1 || idx > COUNT) return null;
  return buildProvider(idx);
}

function buildProvider(idx: number): SandboxProvider {
  const first = FIRST_NAMES[idx % FIRST_NAMES.length];
  const last = LAST_NAMES[(idx * 7) % LAST_NAMES.length];
  const degree = DEGREES[idx % DEGREES.length];
  const state = STATES[idx % STATES.length];
  const status = STATUSES[(idx * 3) % STATUSES.length];
  // Synthetic NPI: take a 9-digit base derived from idx and append a
  // valid Luhn check digit so the shape passes a strict NPI validator.
  // 123456789 is the canonical NCQA fake NPI base; we offset by idx
  // so each sandbox provider gets a unique 10-digit value.
  const npiBase9 = (123_456_789 + (idx - 1)).toString().padStart(9, "0");
  const npi = npiWithChecksum(npiBase9);

  return {
    id: `sandbox-${idx}`,
    name: `${first} ${last}, ${degree}`,
    npi,
    primaryState: state,
    status,
    licenses: [
      {
        state,
        number: `${state}-${100000 + idx * 31}`,
        expiresOn: nextDate(idx, 18, 30),
      },
    ],
    boards: [
      {
        abmsBoard: ABMS_BOARDS[idx % ABMS_BOARDS.length],
        status: idx % 5 === 0 ? "ELIGIBLE" : "CERTIFIED",
      },
    ],
    sanctions: {
      oig: idx % 23 === 0 ? "flagged" : "clear",
      sam: "clear",
      stateMedicaid: idx % 19 === 0 ? "flagged" : "clear",
      lastChecked: nextDate(idx, -1, 28),
    },
    expirables: [
      { type: "DEA", expiresOn: nextDate(idx, 4, 11) },
      { type: "MALPRACTICE_INSURANCE", expiresOn: nextDate(idx, 9, 17) },
    ],
  };
}

/**
 * Stamps a deterministic ISO date `monthsForward` months from a fixed
 * 2026-01-01 anchor (so the sandbox is reproducible across timezones).
 */
function nextDate(idx: number, monthsForward: number, dayMod: number): string {
  // Anchor date lets us avoid `new Date()` and stay deterministic.
  const anchor = Date.UTC(2026, 0, 1); // 2026-01-01
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const ts = anchor + monthsForward * monthMs + ((idx % dayMod) + 1) * 24 * 60 * 60 * 1000;
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * NPI checksum: ISO 7812 Luhn applied to the 9-digit NPI with the
 * '80840' AAMC prefix prepended (per CMS).
 *
 * https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand
 */
export function npiWithChecksum(base9: string): string {
  if (!/^\d{9}$/.test(base9)) {
    throw new Error(`npiWithChecksum requires a 9-digit string, got: ${base9}`);
  }
  const prefixed = `80840${base9}`;
  // Luhn on prefixed
  let sum = 0;
  for (let i = prefixed.length - 1; i >= 0; i--) {
    let d = Number(prefixed[i]);
    if ((prefixed.length - i) % 2 === 1) {
      d = d * 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${base9}${check}`;
}
