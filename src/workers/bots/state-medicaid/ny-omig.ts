/**
 * NY OMIG (Office of the Medicaid Inspector General) Medicaid Exclusion check.
 *
 * Source: https://omig.ny.gov/medicaid-fraud/medicaid-exclusions
 * The OMIG publishes a downloadable Excel/CSV of currently excluded providers
 * and a searchable HTML page. Our approach mirrors the federal SAM.gov bot:
 *   1. Try the public CSV download (fast, deterministic).
 *   2. Fall back to manual when the download is unreachable or unparseable.
 *
 * Until OMIG_NY_ENABLED=true we mark runs as REQUIRES_MANUAL with a clear
 * message pointing staff at the OMIG search page and the manual workflow.
 *
 * NOTE: This is the "framework lands first, real fetch lands behind a feature
 * flag" pattern we already use for NPDB and the education bots. It avoids
 * shipping a bot that can silently miss exclusions because of a format
 * change on a state website nobody is monitoring.
 */

import type {
  StateMedicaidLookupInput,
  StateMedicaidLookupResult,
  StateMedicaidPlugin,
} from "./types";

const SOURCE_URL = "https://omig.ny.gov/medicaid-fraud/medicaid-exclusions";

export const nyOmigPlugin: StateMedicaidPlugin = {
  state: "NY",
  sourceName: "NY OMIG Medicaid Exclusion List",
  sourceUrl: SOURCE_URL,

  isEnabled() {
    return process.env.OMIG_NY_ENABLED === "true";
  },

  async lookup(input: StateMedicaidLookupInput): Promise<StateMedicaidLookupResult> {
    if (!this.isEnabled()) {
      return {
        status: "REQUIRES_MANUAL",
        source: this.sourceName,
        sourceUrl: SOURCE_URL,
        matchCount: 0,
        message:
          `Automated NY OMIG Medicaid exclusion screening is disabled ` +
          `(set OMIG_NY_ENABLED=true to enable). Staff should manually ` +
          `search ${SOURCE_URL} for ${input.lastName}, ${input.firstName}` +
          (input.npi ? ` (NPI ${input.npi})` : "") +
          `, save the resulting screenshot or PDF, and upload it under ` +
          `Documents > Sanctions > NY OMIG.`,
      };
    }

    // Real implementation lands behind OMIG_NY_ENABLED. Until then, throw
    // loudly if someone flips the flag without merging the integration.
    throw new Error(
      "OMIG_NY_ENABLED=true but the NY OMIG fetch/parse implementation " +
        "has not yet shipped. Set OMIG_NY_ENABLED=false until it does, " +
        "or implement the CSV download + name/NPI match in ny-omig.ts."
    );
  },
};
