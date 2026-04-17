/**
 * NPDB Query Bot — STUBBED (manual workflow gate)
 *
 * P0 Gap #1 (April 2026 re-audit): Until Essen completes NPDB registration and
 * obtains HIQA API credentials, this bot does NOT generate fake "no reports"
 * results. Instead, every run is marked REQUIRES_MANUAL with a clear, audit-
 * trailed message so staff perform the NPDB query manually and upload the
 * resulting PDF as documentation of primary source verification.
 *
 * To enable real automated NPDB Continuous Query when credentials are ready:
 *   1. Set NPDB_ENABLED=true and provide NPDB_ENTITY_CODE / NPDB_DUNS via
 *      Azure Key Vault.
 *   2. Replace the manual stub block below with the real HIQA flow:
 *        - send HIQA API request (NPI + name + DOB)
 *        - parse XML response for report count and types
 *        - download full NPDB report PDF if reports found
 *        - create NPDBRecord row and flag any reports
 *
 * See docs/competitive-gap-analysis.md (P0 #1) and
 * docs/planning/open-questions.md Q7.
 */

import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { npdbQueryFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

const NPDB_ENABLED = process.env.NPDB_ENABLED === "true";

export class NpdbQueryBot extends BotBase {
  getBotType(): BotType {
    return "NPDB";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const queryDate = new Date();

    console.log(
      `[NPDB Bot] Provider: ${provider.legalFirstName} ${provider.legalLastName}, ` +
        `NPI: ${provider.npi ?? "N/A"}, BotRunId: ${botRunId}, NPDB_ENABLED=${NPDB_ENABLED}`
    );

    if (NPDB_ENABLED) {
      // Future: real HIQA Continuous Query implementation goes here.
      // For now, when toggled on without an implementation, fail loudly so
      // it's never confused with a successful verification.
      throw new Error(
        "NPDB_ENABLED=true but the real HIQA Continuous Query integration " +
          "has not yet been implemented. Set NPDB_ENABLED=false until it ships."
      );
    }

    // Manual workflow path — flag the bot run as requiring a human and write
    // a clear message to the audit trail. Do NOT create a fake NPDBRecord.
    const message =
      "NPDB automated query is not yet enabled. Please run the NPDB query " +
      "manually at https://www.npdb.hrsa.gov/, download the report PDF, and " +
      "upload it under Documents → NPDB Report. This will be replaced by " +
      "real Continuous Query integration once credentials are provisioned.";

    await this.db.botRun.update({
      where: { id: botRunId },
      data: {
        status: "REQUIRES_MANUAL",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    const outputFilename = npdbQueryFilename(queryDate);

    return {
      status: "ERROR",
      credentialType: "NPDB",
      verifiedDate: queryDate,
      sourceWebsite: "https://www.npdb.hrsa.gov/",
      resultDetails: {
        stub: true,
        requiresManual: true,
        npdbEnabled: NPDB_ENABLED,
        message,
      },
      outputFilename,
      isFlagged: false,
    };
  }
}
