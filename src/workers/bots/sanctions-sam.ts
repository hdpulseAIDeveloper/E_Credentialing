/**
 * SAM.gov Sanctions Check Bot — api.sam.gov REST API
 * Queries the System for Award Management federal exclusions database.
 */

import { BotBase, type BotVerificationResult } from "../bot-base";
import { samSanctionsFilename } from "../../lib/blob-naming";
import { getSecret, KeyVaultSecrets } from "../../lib/azure/keyvault";
import type { BotType, SanctionsResult } from "@prisma/client";

interface SamGovEntity {
  legalBusinessName?: string;
  exclusionType?: string;
  exclusionDate?: string;
  expirationDate?: string;
  uniqueEntityId?: string;
}

interface SamGovResponse {
  totalRecords?: number;
  entityData?: SamGovEntity[];
}

export class SanctionsSamBot extends BotBase {
  getBotType(): BotType {
    return "SAM_SANCTIONS";
  }

  async execute(
    provider: Parameters<BotBase["execute"]>[0],
    botRunId: string
  ): Promise<BotVerificationResult> {
    const runDate = new Date();

    // Get SAM.gov API key from Key Vault or env
    let apiKey: string;
    try {
      apiKey = await getSecret(KeyVaultSecrets.SAM_GOV_API_KEY);
    } catch {
      apiKey = process.env.SAM_GOV_API_KEY ?? "";
    }

    if (!apiKey) {
      throw new Error("SAM.gov API key not available — set SAM_GOV_API_KEY or Key Vault secret");
    }

    let isFlagged = false;
    let exclusionType: string | undefined;
    let exclusionEffectiveDate: Date | undefined;

    try {
      // Query SAM.gov exclusions API
      const params = new URLSearchParams({
        api_key: apiKey,
        q: `${provider.legalFirstName} ${provider.legalLastName}`,
        includeSections: "entityRegistration,exclusionInformation",
        page: "0",
        size: "10",
      });

      if (provider.npi) {
        params.set("npi", provider.npi);
      }

      const response = await fetch(
        `https://api.sam.gov/entity-information/v3/entities?${params.toString()}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        throw new Error(`SAM.gov API error: ${response.status} ${response.statusText}`);
      }

      const data: SamGovResponse = await response.json() as SamGovResponse;

      if (data.totalRecords && data.totalRecords > 0 && data.entityData) {
        // Check for exclusions matching the provider name
        for (const entity of data.entityData) {
          const entityName = (entity.legalBusinessName ?? "").toLowerCase();
          const providerFullName = `${provider.legalFirstName} ${provider.legalLastName}`.toLowerCase();

          if (entityName.includes(provider.legalLastName.toLowerCase())) {
            if (entity.exclusionType) {
              isFlagged = true;
              exclusionType = entity.exclusionType;
              if (entity.exclusionDate) {
                const d = new Date(entity.exclusionDate);
                if (!isNaN(d.getTime())) exclusionEffectiveDate = d;
              }
              break;
            }
          }
          void providerFullName; // suppress unused warning
        }
      }

      // Create SanctionsCheck record
      const sanctionsResult: SanctionsResult = isFlagged ? "FLAGGED" : "CLEAR";

      await this.db.sanctionsCheck.create({
        data: {
          providerId: provider.id,
          source: "SAM_GOV",
          runDate,
          triggeredBy: "AUTOMATIC_INITIAL",
          result: sanctionsResult,
          exclusionType: exclusionType ?? null,
          exclusionEffectiveDate: exclusionEffectiveDate ?? null,
          botRunId,
        },
      });

      const outputFilename = samSanctionsFilename(runDate);

      // Generate a simple text-based PDF summary
      const summaryText = JSON.stringify(
        {
          provider: `${provider.legalFirstName} ${provider.legalLastName}`,
          npi: provider.npi,
          runDate: runDate.toISOString(),
          source: "SAM.gov",
          result: sanctionsResult,
          totalRecordsFound: data.totalRecords ?? 0,
          isFlagged,
          exclusionType: exclusionType ?? "N/A",
        },
        null,
        2
      );

      // Return a text buffer as "PDF" (actual PDF generation would use pdf-lib)
      const pdfBuffer = Buffer.from(summaryText, "utf-8");

      return {
        status: isFlagged ? "FLAGGED" : "VERIFIED",
        credentialType: "SAM_SANCTIONS",
        verifiedDate: runDate,
        sourceWebsite: "https://api.sam.gov/entity-information/v3/entities",
        resultDetails: {
          source: "SAM.gov",
          result: sanctionsResult,
          totalRecords: data.totalRecords ?? 0,
          exclusionType: exclusionType ?? null,
          exclusionEffectiveDate: exclusionEffectiveDate?.toISOString() ?? null,
        },
        pdfBuffer,
        outputFilename,
        isFlagged,
        flagReason: isFlagged
          ? `Provider found on SAM.gov exclusion list. Exclusion type: ${exclusionType ?? "Unknown"}. HARD STOP — do not proceed.`
          : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`SAM.gov sanctions check failed: ${errorMessage}`);
    }
  }
}
