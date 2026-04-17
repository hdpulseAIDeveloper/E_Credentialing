/**
 * ACGME Residency / Fellowship Verification Bot
 *
 * P0 Gap #3 (April 2026 re-audit): Verifies ACGME-accredited residency or
 * fellowship completion via the ACGME ADS Public Site
 * (https://apps.acgme.org/ads/Public/Programs/Search) and the resident
 * verification request form for the specific program.
 *
 * Current implementation: STUB-with-manual-workflow. ACGME does not provide a
 * direct credentialing API; verification is done via the program PD/coordinator.
 * Until ACGME_AUTOMATION_ENABLED=true, this bot marks each run as
 * REQUIRES_MANUAL with a clear message directing staff to email the residency
 * program for verification and upload the response.
 *
 * To enable real automation:
 *   1. Stand up an ACGME program contact directory (cached from ADS).
 *   2. Implement an auto-email outreach flow (similar to work-history
 *      verification) that sends the program coordinator a structured
 *      verification request form.
 *   3. Set ACGME_AUTOMATION_ENABLED=true.
 *   4. Replace the manual-stub block with the outreach + token response flow.
 */

import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { educationVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

const ACGME_ENABLED = process.env.ACGME_AUTOMATION_ENABLED === "true";

export class EducationAcgmeBot extends BotBase {
  getBotType(): BotType {
    return "EDUCATION_ACGME";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const queryDate = new Date();

    console.log(
      `[EducationACGME Bot] Provider: ${provider.legalFirstName} ${provider.legalLastName}, ` +
        `BotRunId: ${botRunId}, ACGME_ENABLED=${ACGME_ENABLED}`
    );

    if (ACGME_ENABLED) {
      throw new Error(
        "ACGME_AUTOMATION_ENABLED=true but the real ACGME outreach flow has " +
          "not yet been implemented. Set ACGME_AUTOMATION_ENABLED=false until " +
          "it ships."
      );
    }

    const message =
      "ACGME residency/fellowship verification is not yet automated. Please " +
      "look up the provider's training program at " +
      "https://apps.acgme.org/ads/Public/Programs/Search, contact the program " +
      "coordinator to confirm dates and completion status, and upload the " +
      "response under Documents → ACGME Verification. This will be replaced " +
      "by automated outreach once the flow is built.";

    await this.db.botRun.update({
      where: { id: botRunId },
      data: {
        status: "REQUIRES_MANUAL",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    return {
      status: "ERROR",
      credentialType: "EDUCATION_RESIDENCY",
      verifiedDate: queryDate,
      sourceWebsite: "https://apps.acgme.org/ads/Public/Programs/Search",
      resultDetails: {
        stub: true,
        requiresManual: true,
        acgmeEnabled: ACGME_ENABLED,
        message,
      },
      outputFilename: educationVerificationFilename("ACGME", queryDate),
      isFlagged: false,
    };
  }
}
