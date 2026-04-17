/**
 * ECFMG Certification Verification Bot
 *
 * P0 Gap #3 (April 2026 re-audit): Verifies ECFMG certification for
 * international medical graduates via the ECFMG Certification Verification
 * Service (CVS) at https://www.ecfmg.org/cvs/.
 *
 * Current implementation: STUB-with-manual-workflow. ECFMG CVS is a paid
 * service ($25/verification) and requires an account. Until credentials are
 * provisioned and ECFMG_CVS_ENABLED=true, this bot marks each run as
 * REQUIRES_MANUAL with a clear message directing staff to perform the lookup
 * manually and upload the resulting verification PDF.
 *
 * To enable real automation:
 *   1. Provision ECFMG CVS account credentials.
 *   2. Store as `ecfmg-cvs-username` / `ecfmg-cvs-password` in Azure Key Vault.
 *   3. Set ECFMG_CVS_ENABLED=true.
 *   4. Replace the manual-stub block with a Playwright login + ECFMG number
 *      (or USMLE ID) lookup flow.
 *   5. Parse the rendered status page and upload PDF artifact.
 */

import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { educationVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

const ECFMG_ENABLED = process.env.ECFMG_CVS_ENABLED === "true";

export class EducationEcfmgBot extends BotBase {
  getBotType(): BotType {
    return "EDUCATION_ECFMG";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const queryDate = new Date();
    const ecfmgNumber = provider.profile?.ecfmgNumber ?? null;

    console.log(
      `[EducationECFMG Bot] Provider: ${provider.legalFirstName} ${provider.legalLastName}, ` +
        `ECFMG#: ${ecfmgNumber ?? "N/A"}, BotRunId: ${botRunId}, ECFMG_ENABLED=${ECFMG_ENABLED}`
    );

    if (ECFMG_ENABLED) {
      throw new Error(
        "ECFMG_CVS_ENABLED=true but the real ECFMG CVS lookup has not yet " +
          "been implemented. Set ECFMG_CVS_ENABLED=false until it ships."
      );
    }

    const message = ecfmgNumber
      ? `ECFMG CVS automated lookup is not yet enabled. Please verify ECFMG #${ecfmgNumber} ` +
        `manually at https://www.ecfmg.org/cvs/, download the verification PDF, ` +
        `and upload it under Documents → ECFMG Certification.`
      : `ECFMG CVS automated lookup is not yet enabled and no ECFMG number is on file ` +
        `for this provider. If the provider is an international medical graduate (IMG), ` +
        `request the ECFMG number, then verify manually at https://www.ecfmg.org/cvs/.`;

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
      credentialType: "ECFMG_CERTIFICATION",
      verifiedDate: queryDate,
      sourceWebsite: "https://www.ecfmg.org/cvs/",
      resultDetails: {
        stub: true,
        requiresManual: true,
        ecfmgEnabled: ECFMG_ENABLED,
        ecfmgNumberOnFile: ecfmgNumber !== null,
        message,
      },
      outputFilename: educationVerificationFilename("ECFMG", queryDate),
      isFlagged: false,
    };
  }
}
