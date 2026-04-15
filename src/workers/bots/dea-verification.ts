/**
 * DEA Verification Bot — STUBBED
 *
 * IMPORTANT: This bot is intentionally stubbed. DEA portal URL and login
 * credentials have not yet been provided by Essen IT.
 *
 * TODO: See docs/planning/open-questions.md Q6 for outstanding items:
 *   - DEA verification portal URL (diversion.usdoj.gov or successor)
 *   - DEA portal account credentials → store in Azure Key Vault as:
 *     dea-portal-username, dea-portal-password
 *   - TOTP setup: store TOTP secret in Key Vault as: dea-portal-totp-secret
 *   - MFA flow: determine if TOTP is at login or per-query
 *
 * When credentials are available, implement:
 *   1. Navigate to DEA portal
 *   2. Login with Key Vault credentials
 *   3. Generate TOTP code using src/lib/totp.ts
 *   4. Submit MFA code
 *   5. Search by DEA number
 *   6. Screenshot result page
 *   7. Extract expiration date and status
 *   8. Save PDF as "DEA Verification, Exp. MM.DD.YYYY"
 */

import { BotBase, type BotVerificationResult } from "../bot-base";
import type { BotType } from "@prisma/client";

export class DeaVerificationBot extends BotBase {
  getBotType(): BotType {
    return "DEA_VERIFICATION";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    botRunId: string
  ): Promise<BotVerificationResult> {
    console.log(
      `[DEA Bot STUB] Provider: ${provider.legalFirstName} ${provider.legalLastName}, DEA: ${provider.deaNumber ?? "not on file"}, BotRunId: ${botRunId}`
    );

    if (!provider.deaNumber) {
      return {
        status: "NOT_FOUND",
        credentialType: "DEA",
        verifiedDate: new Date(),
        sourceWebsite: "https://www.deadiversion.usdoj.gov/",
        resultDetails: {
          stub: true,
          reason: "No DEA number on file for this provider",
        },
        isFlagged: false,
      };
    }

    // Mark as requires_manual — update BotRun status directly
    await this.db.botRun.update({
      where: { id: botRunId },
      data: {
        status: "REQUIRES_MANUAL",
        errorMessage:
          "DEA verification bot is pending credentials setup. See open-questions.md Q6. Manual verification required.",
        completedAt: new Date(),
        outputData: {
          stub: true,
          deaNumber: provider.deaNumber,
          message: "Requires manual DEA portal verification until credentials are configured.",
        },
      },
    });

    // Return a placeholder result — worker will not create VerificationRecord for stubs
    return {
      status: "ERROR",
      credentialType: "DEA",
      verifiedDate: new Date(),
      sourceWebsite: "https://www.deadiversion.usdoj.gov/",
      resultDetails: {
        stub: true,
        deaNumber: provider.deaNumber,
        message:
          "DEA bot is STUBBED — awaiting DEA portal credentials. See open-questions.md Q6.",
        requiresManual: true,
      },
      isFlagged: false,
      flagReason: undefined,
    };
  }
}
