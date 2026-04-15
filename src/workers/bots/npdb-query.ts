/**
 * NPDB Query Bot — STUBBED
 *
 * IMPORTANT: This bot is intentionally stubbed. Essen must complete NPDB
 * registration and obtain API credentials before this can be implemented.
 *
 * TODO: See docs/planning/open-questions.md Q7 for outstanding items:
 *   - NPDB HIQA API credentials (entity code, authorization key)
 *   - Store in Azure Key Vault as: npdb-entity-code, npdb-authorization-key
 *   - NPDB continuous query enrollment setup
 *   - HIQA API endpoint URL
 *
 * When credentials are available, implement:
 *   1. Send HIQA API request (XML or REST) with provider NPI + name + DOB
 *   2. Parse response XML for report count and types
 *   3. Download full NPDB report PDF if reports found
 *   4. Create NPDBRecord in database
 *   5. Flag if any reports found (adverse action, malpractice, etc.)
 *
 * Dev mode: Returns mock "no_reports" result.
 */

import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { npdbQueryFilename } from "../../lib/blob-naming";
import type { BotType, NpdbResult } from "@prisma/client";

export class NpdbQueryBot extends BotBase {
  getBotType(): BotType {
    return "NPDB";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const queryDate = new Date();
    const isDev = process.env.NODE_ENV === "development";

    console.log(
      `[NPDB Bot STUB] Provider: ${provider.legalFirstName} ${provider.legalLastName}, NPI: ${provider.npi ?? "N/A"}, BotRunId: ${botRunId}`
    );

    // In dev mode, return mock no_reports result
    if (isDev) {
      const result: NpdbResult = "NO_REPORTS";

      await this.db.nPDBRecord.create({
        data: {
          providerId: provider.id,
          queryDate,
          queryType: "INITIAL",
          continuousQueryEnrolled: false,
          result,
          reportCount: 0,
          reports: [],
          botRunId,
        },
      });

      const outputFilename = npdbQueryFilename(queryDate);

      return {
        status: "VERIFIED",
        credentialType: "NPDB",
        verifiedDate: queryDate,
        sourceWebsite: "https://www.npdb.hrsa.gov/",
        resultDetails: {
          stub: true,
          mode: "development_mock",
          result: "NO_REPORTS",
          message:
            "NPDB bot is STUBBED — awaiting NPDB registration. Returns mock 'no_reports' in dev mode. See open-questions.md Q7.",
          npdbRecordCreated: true,
        },
        outputFilename,
        isFlagged: false,
      };
    }

    // Production stub — mark as requires_manual
    await this.db.botRun.update({
      where: { id: botRunId },
      data: {
        status: "REQUIRES_MANUAL",
        errorMessage:
          "NPDB query bot is pending registration. See open-questions.md Q7. Manual NPDB query required.",
        completedAt: new Date(),
      },
    });

    return {
      status: "ERROR",
      credentialType: "NPDB",
      verifiedDate: queryDate,
      sourceWebsite: "https://www.npdb.hrsa.gov/",
      resultDetails: {
        stub: true,
        message: "NPDB bot requires registration. See open-questions.md Q7.",
        requiresManual: true,
      },
      isFlagged: false,
    };
  }
}
