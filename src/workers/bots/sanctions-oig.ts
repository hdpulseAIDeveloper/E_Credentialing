/**
 * OIG Sanctions Check Bot — exclusions.oig.hhs.gov
 * Downloads and queries the LEIE (List of Excluded Individuals/Entities).
 * Hard-stop if provider is flagged — creates SanctionsCheck record.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult } from "../bot-base";
import { oigSanctionsFilename } from "../../lib/blob-naming";
import type { BotType, SanctionsResult } from "@prisma/client";

export class SanctionsOigBot extends BotBase {
  getBotType(): BotType {
    return "OIG_SANCTIONS";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    botRunId: string
  ): Promise<BotVerificationResult> {
    const runDate = new Date();
    let isFlagged = false;
    let exclusionType: string | undefined;
    let exclusionEffectiveDate: Date | undefined;
    let exclusionBasis: string | undefined;
    let pdfBuffer: Buffer | undefined;

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });

      // Navigate to OIG exclusions search
      await page.goto("https://exclusions.oig.hhs.gov/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Fill in provider information
      const lastNameField = page.locator('input[name="lastName"], #lastName, input[placeholder*="Last"]');
      const firstNameField = page.locator('input[name="firstName"], #firstName, input[placeholder*="First"]');
      const npiField = page.locator('input[name="npi"], #NPI, input[placeholder*="NPI"]');

      if (await lastNameField.count() > 0) {
        await lastNameField.fill(provider.legalLastName);
      }
      if (await firstNameField.count() > 0) {
        await firstNameField.fill(provider.legalFirstName);
      }
      if (provider.npi && await npiField.count() > 0) {
        await npiField.fill(provider.npi);
      }

      // Submit search
      const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Search")');
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      }

      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body") ?? "";
      const currentUrl = page.url();

      // Check for exclusion results
      const noResults =
        bodyText.toLowerCase().includes("no results") ||
        bodyText.toLowerCase().includes("no records") ||
        bodyText.toLowerCase().includes("0 result");

      if (!noResults) {
        // Check if the result matches this provider
        const nameMatch =
          bodyText.toLowerCase().includes(provider.legalLastName.toLowerCase()) &&
          bodyText.toLowerCase().includes(provider.legalFirstName.toLowerCase());

        if (nameMatch || provider.npi) {
          // Look for exclusion details
          const exclusionMatch = bodyText.match(/exclusion\s+type[:\s]+([^\n]+)/i);
          const dateMatch = bodyText.match(/effective\s+date[:\s]+([0-9\/\-\.]+)/i);
          const basisMatch = bodyText.match(/exclusion\s+basis[:\s]+([^\n]+)/i);

          if (exclusionMatch || dateMatch) {
            isFlagged = true;
            exclusionType = exclusionMatch?.[1]?.trim();
            exclusionBasis = basisMatch?.[1]?.trim();
            if (dateMatch?.[1]) {
              const d = new Date(dateMatch[1]);
              if (!isNaN(d.getTime())) exclusionEffectiveDate = d;
            }
          }
        }
      }

      // Take screenshot/PDF of results
      pdfBuffer = await page.pdf({
        format: "Letter",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:10px;padding:5px 20px;">OIG Exclusions Check — ${provider.legalFirstName} ${provider.legalLastName} — ${runDate.toISOString()}</div>`,
        footerTemplate: `<div style="font-size:10px;padding:5px 20px;">URL: ${currentUrl}</div>`,
      });

      // Create SanctionsCheck record
      const sanctionsResult: SanctionsResult = isFlagged ? "FLAGGED" : "CLEAR";

      await this.db.sanctionsCheck.create({
        data: {
          providerId: provider.id,
          source: "OIG",
          runDate,
          triggeredBy: "AUTOMATIC_INITIAL",
          result: sanctionsResult,
          exclusionType: exclusionType ?? null,
          exclusionEffectiveDate: exclusionEffectiveDate ?? null,
          exclusionBasis: exclusionBasis ?? null,
          botRunId,
        },
      });

      const outputFilename = oigSanctionsFilename(runDate);

      return {
        status: isFlagged ? "FLAGGED" : "VERIFIED",
        credentialType: "OIG_SANCTIONS",
        verifiedDate: runDate,
        sourceWebsite: currentUrl,
        resultDetails: {
          source: "OIG",
          result: sanctionsResult,
          exclusionType: exclusionType ?? null,
          exclusionEffectiveDate: exclusionEffectiveDate?.toISOString() ?? null,
          exclusionBasis: exclusionBasis ?? null,
          rawTextSnippet: bodyText.slice(0, 500),
        },
        pdfBuffer,
        outputFilename,
        isFlagged,
        flagReason: isFlagged
          ? `Provider found on OIG exclusion list. Exclusion type: ${exclusionType ?? "Unknown"}. HARD STOP — do not proceed.`
          : undefined,
      };
    } finally {
      await browser.close();
    }
  }
}
