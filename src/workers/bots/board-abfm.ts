/**
 * ABFM Board Certification Verification Bot — portfolio.theabfm.org
 * Used for Family Medicine physicians.
 * NOTE: Uses SSN last 4 digits + DOB — decrypted in-memory, never logged.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult } from "../bot-base";
import { boardVerificationFilename } from "../../lib/blob-naming";
import { decryptOptional } from "../../lib/encryption";
import type { BotType } from "@prisma/client";

export class BoardAbfmBot extends BotBase {
  getBotType(): BotType {
    return "BOARD_ABFM";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    _botRunId: string
  ): Promise<BotVerificationResult> {
    // Decrypt PHI fields in memory — NEVER log these values
    let ssnLast4: string | null = null;
    let dobString: string | null = null;

    try {
      if (provider.ssn) {
        const fullSsn = decryptOptional(provider.ssn);
        if (fullSsn) {
          ssnLast4 = fullSsn.slice(-4);
          // fullSsn goes out of scope here — GC'd
        }
      }
      if (provider.dateOfBirth) {
        dobString = decryptOptional(provider.dateOfBirth);
      }
    } catch (error) {
      console.error("[ABFM Bot] Failed to decrypt PHI fields (no PHI in log):", typeof error);
    }

    if (!ssnLast4 || !dobString) {
      return {
        status: "ERROR",
        credentialType: "BOARD_ABFM",
        verifiedDate: new Date(),
        sourceWebsite: "https://portfolio.theabfm.org",
        resultDetails: {
          error: "SSN or DOB not available for ABFM verification",
          // Never include actual SSN or DOB in result details
        },
        isFlagged: true,
        flagReason: "Missing required PHI for ABFM verification (SSN last 4 / DOB)",
      };
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });

      await page.goto("https://portfolio.theabfm.org", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Fill provider name
      await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName);
      await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName);

      // Fill SSN last 4 (in-memory only, cleared after use)
      const ssnField = page.locator('input[name="ssn4"], input[placeholder*="SSN"], input[placeholder*="last 4"]');
      if (await ssnField.count() > 0) {
        await ssnField.fill(ssnLast4);
      }

      // Fill DOB
      const dobField = page.locator('input[name="dob"], input[type="date"], input[placeholder*="Birth"]');
      if (await dobField.count() > 0) {
        await dobField.fill(dobString);
      }

      // Submit
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      const bodyText = await page.textContent("body") ?? "";
      const currentUrl = page.url();

      // Download verification letter if available
      let pdfBuffer: Buffer | null = null;

      const downloadLink = page.locator('a:has-text("Download"), a:has-text("Verification Letter"), a[href*=".pdf"]');
      if (await downloadLink.count() > 0) {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 15000 }),
          downloadLink.first().click(),
        ]);

        const stream = await download.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
        }
        pdfBuffer = Buffer.concat(chunks);
      } else {
        // Fall back to PDF print
        pdfBuffer = await page.pdf({ format: "Letter", printBackground: true });
      }

      // Parse certification
      const expiryMatch = bodyText.match(/expir(?:ation|es?)[:\s]+([0-9\/\-\.]+)/i);
      let expirationDate: Date | null = null;
      if (expiryMatch?.[1]) {
        expirationDate = new Date(expiryMatch[1]);
        if (isNaN(expirationDate.getTime())) expirationDate = null;
      }

      const isCertified = bodyText.toLowerCase().includes("certified") &&
        !bodyText.toLowerCase().includes("not certified");

      const outputFilename = boardVerificationFilename("ABFM", expirationDate ?? new Date());

      // Clear sensitive data from memory
      ssnLast4 = null;
      dobString = null;

      return {
        status: isCertified ? "VERIFIED" : "FLAGGED",
        credentialType: "BOARD_ABFM",
        verifiedDate: new Date(),
        expirationDate,
        sourceWebsite: currentUrl,
        resultDetails: {
          board: "ABFM",
          isCertified,
          // SSN last 4 and DOB are NOT included here — cleared after use
          rawTextSnippet: bodyText.slice(0, 500),
        },
        pdfBuffer: pdfBuffer ?? undefined,
        outputFilename,
        isFlagged: !isCertified,
        flagReason: !isCertified
          ? `ABFM certification not verified for ${provider.legalFirstName} ${provider.legalLastName}`
          : undefined,
      };
    } finally {
      await browser.close();
      // Ensure PHI is cleared even on error
      ssnLast4 = null;
      dobString = null;
    }
  }
}
