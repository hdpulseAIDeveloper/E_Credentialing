/**
 * NCCPA Board Certification Verification Bot — portal.nccpa.net/verifypa
 * Used for Physician Assistants (PA).
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { boardVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

const ESSEN_ORG_NAME = "Essen Medical Associates";
const ESSEN_ORG_EMAIL = "cred_onboarding@essenmed.com";

export class BoardNccpaBot extends BotBase {
  getBotType(): BotType {
    return "BOARD_NCCPA";
  }

  async execute(
    provider: BotProviderPayload,
    _botRunId: string
  ): Promise<BotVerificationResult> {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });

      await page.goto("https://portal.nccpa.net/verifypa", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Fill in provider name fields
      await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName);
      await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName);

      // Select state if present
      try {
        const primaryLicense = provider.licenses[0];
        if (primaryLicense?.state) {
          await page.selectOption('select[name="state"]', primaryLicense.state);
        }
      } catch {
        // State field may not be present
      }

      // Select country
      try {
        await page.selectOption('select[name="country"]', "United States");
      } catch {
        // Country field may not be present
      }

      // Submit search
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      const bodyText = await page.textContent("body") ?? "";

      // Check if "Email Document" option is available
      const hasEmailOption = bodyText.toLowerCase().includes("email") ||
        await page.locator('button:has-text("Email"), a:has-text("Email")').count() > 0;

      if (hasEmailOption) {
        // Click email document button
        try {
          await page.click('button:has-text("Email"), a:has-text("Email Document")');
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

          // Fill in organization details
          await page.fill('input[name="organization"], input[placeholder*="Organization"]', ESSEN_ORG_NAME);
          await page.fill('input[name="email"], input[type="email"]', ESSEN_ORG_EMAIL);
          await page.fill('input[name="name"], input[placeholder*="Name"]', "Essen Credentialing Department");

          await page.click('button[type="submit"]');
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        } catch (e) {
          console.warn("[NCCPA Bot] Email document flow failed:", e);
        }
      }

      // Take full-page screenshot as verification artifact
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
      });

      // Extract certification details from page text
      const certifiedMatch = bodyText.match(/certif(?:ied|ication)[:\s]+([^\n]+)/i);
      const expiryMatch = bodyText.match(/expir(?:ation|es?)[:\s]+([0-9\/\-\.]+)/i);

      let expirationDate: Date | null = null;
      if (expiryMatch?.[1]) {
        expirationDate = new Date(expiryMatch[1]);
        if (isNaN(expirationDate.getTime())) expirationDate = null;
      }

      const isCertified =
        bodyText.toLowerCase().includes("certified") &&
        !bodyText.toLowerCase().includes("not certified") &&
        !bodyText.toLowerCase().includes("expired");

      const outputFilename = boardVerificationFilename("NCCPA", expirationDate ?? new Date());

      return {
        status: isCertified ? "VERIFIED" : "FLAGGED",
        credentialType: "BOARD_NCCPA",
        verifiedDate: new Date(),
        expirationDate,
        sourceWebsite: page.url(),
        resultDetails: {
          board: "NCCPA",
          isCertified,
          certificationText: certifiedMatch?.[1] ?? "",
          emailRequestSent: hasEmailOption,
          emailTo: ESSEN_ORG_EMAIL,
          rawTextSnippet: bodyText.slice(0, 500),
          pendingEmailPickup: hasEmailOption,
        },
        pdfBuffer,
        outputFilename,
        isFlagged: !isCertified,
        flagReason: !isCertified
          ? `NCCPA certification not verified as current for ${provider.legalFirstName} ${provider.legalLastName}`
          : undefined,
      };
    } finally {
      await browser.close();
    }
  }
}
