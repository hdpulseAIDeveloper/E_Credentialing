/**
 * Generic Enrollment Portal Bot — parameterized for MPP, Availity, Verity, EyeMed.
 * Credentials retrieved from Azure Key Vault by portal name.
 */

import { chromium } from "playwright";
import { BotBase, type BotVerificationResult, type BotProviderPayload } from "../bot-base";
import { getSecret } from "../../lib/azure/keyvault";
import type { BotType } from "@prisma/client";

export type EnrollmentPortal = "MPP" | "AVAILITY" | "VERITY" | "EYEMED" | "VNS";

const PORTAL_CONFIG: Record<EnrollmentPortal, {
  url: string;
  secretPrefix: string;
  name: string;
}> = {
  MPP: {
    url: "https://www.mypracticeprofile.com/",
    secretPrefix: "mpp",
    name: "My Practice Profile",
  },
  AVAILITY: {
    url: "https://apps.availity.com/",
    secretPrefix: "availity",
    name: "Availity",
  },
  VERITY: {
    url: "https://www.verity.net/",
    secretPrefix: "verity",
    name: "Verity",
  },
  EYEMED: {
    url: "https://provider.eyemed.com/",
    secretPrefix: "eyemed",
    name: "EyeMed",
  },
  VNS: {
    url: "https://provider.vnshealth.org/",
    secretPrefix: "vns",
    name: "VNS Health",
  },
};

export class EnrollmentPortalBot extends BotBase {
  private portal: EnrollmentPortal;

  constructor(portal: EnrollmentPortal) {
    super();
    this.portal = portal;
  }

  getBotType(): BotType {
    return "ENROLLMENT_SUBMISSION";
  }

  async execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult> {
    const config = PORTAL_CONFIG[this.portal];

    // Get credentials from Key Vault
    let username: string;
    let password: string;

    try {
      [username, password] = await Promise.all([
        getSecret(`${config.secretPrefix}-portal-username`),
        getSecret(`${config.secretPrefix}-portal-password`),
      ]);
    } catch (error) {
      throw new Error(
        `Failed to retrieve ${config.name} credentials from Key Vault: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get enrollment record for this provider and portal
    const enrollment = await this.db.enrollment.findFirst({
      where: {
        providerId: provider.id,
        portalName: config.name,
        status: { in: ["DRAFT", "ERROR"] },
      },
    });

    if (!enrollment) {
      return {
        status: "ERROR",
        credentialType: "EMEDRAL",
        verifiedDate: new Date(),
        sourceWebsite: config.url,
        resultDetails: {
          portal: config.name,
          error: `No draft enrollment record found for ${config.name}`,
        },
        isFlagged: false,
      };
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });

      // Navigate to portal
      await page.goto(config.url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Login
      await page.fill('input[name="username"], input[type="text"], input[name="email"]', username);
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

      // Navigate to provider enrollment section
      const enrollmentLink = page.locator('a:has-text("Enrollment"), a:has-text("Add Provider"), a:has-text("Provider")');
      if (await enrollmentLink.count() > 0) {
        await enrollmentLink.first().click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      }

      // Fill provider information
      if (provider.npi) {
        const npiField = page.locator('input[name="npi"], input[placeholder*="NPI"]');
        if (await npiField.count() > 0) {
          await npiField.fill(provider.npi);
        }
      }

      await page.fill('input[name="lastName"], input[placeholder*="Last"]', provider.legalLastName).catch(() => {});
      await page.fill('input[name="firstName"], input[placeholder*="First"]', provider.legalFirstName).catch(() => {});

      // Submit
      await page.click('button[type="submit"], button:has-text("Submit"), button:has-text("Save")').catch(() => {});
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

      const bodyText = await page.textContent("body") ?? "";
      const currentUrl = page.url();

      // Extract confirmation number
      const confirmationMatch = bodyText.match(/(?:confirmation|reference|tracking)\s+(?:number|#|no\.?)[:\s]+([A-Z0-9\-]+)/i);
      const confirmationNumber = confirmationMatch?.[1];

      const pdfBuffer = await page.pdf({ format: "Letter", printBackground: true });

      // Update enrollment status
      await this.db.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          payerConfirmationNumber: confirmationNumber ?? null,
        },
      });

      return {
        status: "VERIFIED",
        credentialType: "EMEDRAL", // Generic credential type for enrollment
        verifiedDate: new Date(),
        sourceWebsite: currentUrl,
        resultDetails: {
          portal: config.name,
          enrollmentId: enrollment.id,
          confirmationNumber: confirmationNumber ?? null,
          submitted: true,
          botRunId,
        },
        pdfBuffer,
        outputFilename: `${config.name.replace(/\s+/g, "_")}_Enrollment_${provider.legalLastName}_${new Date().toISOString().split("T")[0]}`,
        isFlagged: false,
      };
    } finally {
      await browser.close();
    }
  }
}
