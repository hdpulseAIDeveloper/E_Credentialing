/**
 * License Verification Bot — healthguideusa.org
 * Verifies state medical licenses for all provider types.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { licenseVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

// Provider type to healthguideusa profession dropdown mapping
const PROFESSION_MAP: Record<string, string> = {
  MD: "Physician",
  DO: "Physician",
  PA: "Physician Assistant",
  NP: "Nurse Practitioner",
  LCSW: "Licensed Clinical Social Worker",
  LMHC: "Licensed Mental Health Counselor",
};

export class LicenseVerificationBot extends BotBase {
  getBotType(): BotType {
    return "LICENSE_VERIFICATION";
  }

  async execute(
    provider: BotProviderPayload,
    _botRunId: string
  ): Promise<BotVerificationResult> {
    const primaryLicense = provider.licenses.find((l) => l.isPrimary) ?? provider.licenses[0];

    if (!primaryLicense) {
      return {
        status: "NOT_FOUND",
        credentialType: "LICENSE",
        verifiedDate: new Date(),
        sourceWebsite: "https://www.healthguideusa.org/",
        resultDetails: { error: "No license found for provider" },
        isFlagged: true,
        flagReason: "No license on file to verify",
      };
    }

    const profession = PROFESSION_MAP[provider.providerType.abbreviation] ?? "Physician";
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 800 });

      // Navigate to healthguideusa.org license verification
      await page.goto("https://www.healthguideusa.org/", { waitUntil: "domcontentloaded", timeout: 30000 });

      // Select state
      await page.selectOption('select[name="state"]', primaryLicense.state);

      // Select profession
      await page.selectOption('select[name="profession"]', { label: profession });

      // Enter license number
      await page.fill('input[name="license_number"]', primaryLicense.licenseNumber);

      // Submit search
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      // Extract license details from results
      const resultText = await page.textContent("body") ?? "";

      // Parse status
      const isActive =
        resultText.toLowerCase().includes("active") &&
        !resultText.toLowerCase().includes("expired") &&
        !resultText.toLowerCase().includes("suspended") &&
        !resultText.toLowerCase().includes("revoked");

      // Extract expiration date
      const expirationMatch = resultText.match(/expir(?:ation|es?)[:\s]+([0-9\/\-\.]+)/i);
      let expirationDate: Date | null = null;
      if (expirationMatch?.[1]) {
        expirationDate = new Date(expirationMatch[1]);
        if (isNaN(expirationDate.getTime())) expirationDate = null;
      }

      // Take full-page screenshot
      const screenshotBuffer = await page.screenshot({ fullPage: true });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
      });

      const outputFilename = licenseVerificationFilename(
        primaryLicense.state,
        expirationDate ?? new Date()
      );

      const isFlagged = !isActive;

      return {
        status: isActive ? "VERIFIED" : "FLAGGED",
        credentialType: "LICENSE",
        verifiedDate: new Date(),
        expirationDate,
        sourceWebsite: page.url(),
        resultDetails: {
          licenseNumber: primaryLicense.licenseNumber,
          state: primaryLicense.state,
          profession,
          isActive,
          rawStatusText: resultText.slice(0, 500),
          screenshotTaken: true,
        },
        pdfBuffer,
        outputFilename,
        isFlagged,
        flagReason: isFlagged ? `License status is not Active (provider: ${provider.legalFirstName} ${provider.legalLastName}, state: ${primaryLicense.state})` : undefined,
      };
    } finally {
      await browser.close();
    }
  }
}
