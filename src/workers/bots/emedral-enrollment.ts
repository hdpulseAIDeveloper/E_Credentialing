/**
 * eMedNY Enrollment Bot — Playwright shell for NY Medicaid enrollment.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult } from "../bot-base";
import { getSecret, KeyVaultSecrets } from "../../lib/azure/keyvault";
import type { BotType } from "@prisma/client";

export class EmedralEnrollmentBot extends BotBase {
  getBotType(): BotType {
    return "EMEDRAL_ETIN";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    botRunId: string
  ): Promise<BotVerificationResult> {
    // Get credentials from Key Vault
    let username: string;
    let password: string;

    try {
      [username, password] = await Promise.all([
        getSecret(KeyVaultSecrets.EMEDRAL_USERNAME),
        getSecret(KeyVaultSecrets.EMEDRAL_PASSWORD),
      ]);
    } catch (error) {
      throw new Error(
        `Failed to retrieve eMedNY credentials from Key Vault: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get MedicaidEnrollment record for this provider
    const medicaidRecord = await this.db.medicaidEnrollment.findFirst({
      where: { providerId: provider.id, affiliationStatus: "PENDING" },
    });

    if (!medicaidRecord) {
      return {
        status: "ERROR",
        credentialType: "EMEDRAL",
        verifiedDate: new Date(),
        sourceWebsite: "https://www.emedny.org/",
        resultDetails: {
          error: "No pending MedicaidEnrollment record found for provider",
          providerId: provider.id,
        },
        isFlagged: false,
      };
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });

      // Navigate to eMedNY portal
      await page.goto("https://www.emedny.org/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Login
      const loginBtn = page.locator('a:has-text("Provider Login"), a:has-text("Login")');
      if (await loginBtn.count() > 0) {
        await loginBtn.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      }

      await page.fill('input[name="username"], input[type="text"]', username);
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

      // Navigate to enrollment section
      const enrollmentLink = page.locator('a:has-text("Enrollment"), a:has-text("Provider Enrollment")');
      if (await enrollmentLink.count() > 0) {
        await enrollmentLink.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      }

      // Populate enrollment form from MedicaidEnrollment record
      // Fill NPI
      const npiField = page.locator('input[name="npi"], input[placeholder*="NPI"]');
      if (provider.npi && await npiField.count() > 0) {
        await npiField.fill(provider.npi);
      }

      // Fill provider name
      await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName).catch(() => {});
      await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName).catch(() => {});

      // Update application populated timestamp
      await this.db.medicaidEnrollment.update({
        where: { id: medicaidRecord.id },
        data: { applicationPopulatedAt: new Date() },
      });

      // Submit enrollment form
      const submitBtn = page.locator('button[type="submit"]:has-text("Submit"), button:has-text("Submit Enrollment")');
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
      }

      const bodyText = await page.textContent("body") ?? "";
      const currentUrl = page.url();

      // Extract confirmation number
      const confirmationMatch = bodyText.match(/confirmation\s+(?:number|#|no\.?)[:\s]+([A-Z0-9\-]+)/i);
      const confirmationNumber = confirmationMatch?.[1];

      const pdfBuffer = await page.pdf({ format: "Letter", printBackground: true });

      // Update medicaid enrollment record
      if (confirmationNumber) {
        await this.db.medicaidEnrollment.update({
          where: { id: medicaidRecord.id },
          data: {
            affiliationStatus: "IN_PROCESS",
            submissionDate: new Date(),
            botRunId,
          },
        });
      }

      return {
        status: "VERIFIED",
        credentialType: "EMEDRAL",
        verifiedDate: new Date(),
        sourceWebsite: currentUrl,
        resultDetails: {
          medicaidEnrollmentId: medicaidRecord.id,
          confirmationNumber: confirmationNumber ?? null,
          formPopulated: true,
          submitted: !!confirmationNumber,
          responseSnippet: bodyText.slice(0, 500),
        },
        pdfBuffer,
        outputFilename: `eMedNY_Enrollment_${provider.legalLastName}_${new Date().toISOString().split("T")[0]}`,
        isFlagged: false,
      };
    } finally {
      await browser.close();
    }
  }
}
