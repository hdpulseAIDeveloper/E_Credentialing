/**
 * State Medicaid exclusion plug-in framework (P0 Gap #5)
 *
 * 45 states + DC maintain separate Medicaid exclusion lists. NCQA 2026 and
 * Joint Commission Accreditation 360 require screening every state in which
 * the practitioner practices, not just federal OIG/SAM.
 *
 * Each state plug-in implements StateMedicaidPlugin. The runner picks the
 * plug-in by state code (e.g., "NY" → ny-omig) and dispatches the lookup.
 *
 * Adding a new state:
 *   1. Create a file `src/workers/bots/state-medicaid/<code>-<source>.ts`
 *      that exports a `StateMedicaidPlugin`.
 *   2. Register it in `src/workers/bots/state-medicaid/index.ts`.
 *   3. Add the state code to the STATE_MEDICAID_PLUGINS env var.
 */

export interface StateMedicaidLookupInput {
  npi: string | null;
  firstName: string;
  lastName: string;
  state: string;
}

export type StateMedicaidExclusionStatus =
  | "CLEAR"
  | "EXCLUDED"
  | "REQUIRES_MANUAL"
  | "ERROR";

export interface StateMedicaidLookupResult {
  status: StateMedicaidExclusionStatus;
  source: string;
  sourceUrl: string;
  matchCount: number;
  exclusionDetails?: {
    type?: string;
    effectiveDate?: string;
    basis?: string;
  } | null;
  evidencePdfBuffer?: Buffer | null;
  evidencePdfFilename?: string;
  message?: string;
}

export interface StateMedicaidPlugin {
  /** Two-letter state code (uppercase). */
  state: string;
  /** Human-readable source label, e.g., "NY OMIG Medicaid Exclusion List". */
  sourceName: string;
  /** Public-facing URL where the list is published. */
  sourceUrl: string;
  /** Returns whether this plug-in is currently runnable (e.g., env-gated). */
  isEnabled(): boolean;
  /** Performs the exclusion lookup and returns a structured result. */
  lookup(input: StateMedicaidLookupInput): Promise<StateMedicaidLookupResult>;
}
