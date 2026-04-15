/**
 * ABIM Board Certification Verification Bot — abim.org/verify-physician/
 * Used for Internal Medicine physicians.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult } from "../bot-base";
import { boardVerificationFilename } from "../../lib/blob-naming";
import type { BotType } from "@prisma/client";

export class BoardAbimBot extends BotBase {
  getBotType(): BotType {
    return "BOARD_ABIM";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    _botRunId: string
  ): Promise<BotVerificationResult> {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });

      await page.goto("https://www.abim.org/verify-physician/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Search by NPI if available, otherwise by name
      if (provider.npi) {
        // Try NPI search field
        const npiField = page.locator('input[name="npi"], input[placeholder*="NPI"]');
        if (await npiField.count() > 0) {
          await npiField.fill(provider.npi);
        } else {
          // Fall back to name search
          await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName);
          await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName);
        }
      } else {
        await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName);
        await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName);
      }

      // Submit search
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      // Wait for results to load
      await page.waitForTimeout(2000);

      // If there are multiple results, click the first matching one
      const results = page.locator('table tr, .result-row, .physician-result');
      if (await results.count() > 0) {
        // Click first result that matches name
        await results.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
      }

      const bodyText = await page.textContent("body") ?? "";
      const currentUrl = page.url();

      // Ensure URL and timestamp are visible in the screenshot
      await page.evaluate((url) => {
        const div = document.createElement("div");
        div.style.cssText =
          "position:fixed;top:0;left:0;background:#fff;padding:8px;font-family:monospace;font-size:12px;z-index:99999;border-bottom:2px solid #333;width:100%;";
        div.textContent = `ABIM Verification — URL: ${url} — Timestamp: ${new Date().toISOString()}`;
        document.body.prepend(div);
      }, currentUrl);

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:10px;padding:5px 20px;">ABIM Verification — ${provider.legalFirstName} ${provider.legalLastName} — ${new Date().toISOString()}</div>`,
        footerTemplate: `<div style="font-size:10px;padding:5px 20px;">URL: ${currentUrl}</div>`,
      });

      // Parse certification status
      const expiryMatch = bodyText.match(/MOC\s+(?:valid|expires?|through)[:\s]+([0-9\/\-\.]+)/i) ??
        bodyText.match(/expir(?:ation|es?)[:\s]+([0-9\/\-\.]+)/i);

      let expirationDate: Date | null = null;
      if (expiryMatch?.[1]) {
        expirationDate = new Date(expiryMatch[1]);
        if (isNaN(expirationDate.getTime())) expirationDate = null;
      }

      const isCertified =
        bodyText.toLowerCase().includes("certified") &&
        !bodyText.toLowerCase().includes("not certified");

      const outputFilename = boardVerificationFilename("ABIM", expirationDate ?? new Date());

      return {
        status: isCertified ? "VERIFIED" : "FLAGGED",
        credentialType: "BOARD_ABIM",
        verifiedDate: new Date(),
        expirationDate,
        sourceWebsite: currentUrl,
        resultDetails: {
          board: "ABIM",
          isCertified,
          npiSearched: provider.npi,
          rawTextSnippet: bodyText.slice(0, 500),
        },
        pdfBuffer,
        outputFilename,
        isFlagged: !isCertified,
        flagReason: !isCertified
          ? `ABIM certification not verified for ${provider.legalFirstName} ${provider.legalLastName}`
          : undefined,
      };
    } finally {
      await browser.close();
    }
  }
}
