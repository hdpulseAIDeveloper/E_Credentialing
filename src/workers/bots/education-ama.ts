/**
 * AMA Physician Masterfile Verification Bot
 *
 * P0 Gap #3 (April 2026 re-audit): One of the 11 NCQA CVO products. Verifies
 * a physician's medical school graduation, GME training, and licensure history
 * via the AMA Physician Masterfile (https://amaphysicianprofile.com/).
 *
 * Current implementation: STUB-with-manual-workflow. AMA Profiles requires a
 * paid subscription and an API agreement. Until credentials are provisioned
 * and AMA_PROFILES_ENABLED=true, this bot marks each run as REQUIRES_MANUAL
 * with a clear message directing staff to perform the lookup manually and
 * upload the resulting profile PDF.
 *
 * To enable real automation:
 *   1. Provision AMA Physician Profiles API credentials.
 *   2. Store as `ama-profiles-username` / `ama-profiles-password` in Azure
 *      Key Vault.
 *   3. Set AMA_PROFILES_ENABLED=true.
 *   4. Replace the manual-stub block with a Playwright login + lookup flow
 *      against amaphysicianprofile.com (NPI lookup is the simplest entry).
 *   5. Parse the rendered profile and upload PDF artifact.
 */

import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { educationVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

const AMA_ENABLED = process.env.AMA_PROFILES_ENABLED === "true";

export class EducationAmaBot extends BotBase {
  getBotType(): BotType {
    return "EDUCATION_AMA";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const queryDate = new Date();

    console.log(
      `[EducationAMA Bot] Provider: ${provider.legalFirstName} ${provider.legalLastName}, ` +
        `NPI: ${provider.npi ?? "N/A"}, BotRunId: ${botRunId}, AMA_ENABLED=${AMA_ENABLED}`
    );

    if (AMA_ENABLED) {
      throw new Error(
        "AMA_PROFILES_ENABLED=true but the real AMA Physician Masterfile " +
          "lookup has not yet been implemented. Set AMA_PROFILES_ENABLED=false " +
          "until it ships."
      );
    }

    const message =
      "AMA Physician Masterfile automated lookup is not yet enabled. Please " +
      "look up the provider manually at https://amaphysicianprofile.com/, " +
      "download the profile PDF, and upload it under Documents → Education " +
      "Verification (AMA). This will be replaced by automated lookup once " +
      "AMA Profiles credentials are provisioned.";

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
      credentialType: "EDUCATION_MEDICAL_SCHOOL",
      verifiedDate: queryDate,
      sourceWebsite: "https://amaphysicianprofile.com/",
      resultDetails: {
        stub: true,
        requiresManual: true,
        amaEnabled: AMA_ENABLED,
        message,
      },
      outputFilename: educationVerificationFilename("AMA", queryDate),
      isFlagged: false,
    };
  }
}
