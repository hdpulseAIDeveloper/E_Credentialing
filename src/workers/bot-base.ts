/**
 * Abstract base class for all PSV bots.
 * Handles BotRun record lifecycle, PDF saving to blob, VerificationRecord creation.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type { BotType, CredentialType, VerificationStatus } from "@prisma/client";
import { uploadDocument } from "../lib/azure/blob";
import { verificationBlobPath } from "../lib/blob-naming";
import { writeAuditLog } from "../lib/audit";
import { createMonitoringAlert } from "../lib/monitoring-alerts";
import type { MonitoringAlertType } from "@prisma/client";
import { orchestrateBotException } from "../lib/ai/agent-orchestrator";

const db = new PrismaClient();

export type BotProviderPayload = Prisma.ProviderGetPayload<{
  include: { providerType: true; profile: true; licenses: true };
}>;

export interface BotRunInput {
  botRunId: string;
  providerId: string;
}

export interface BotVerificationResult {
  status: VerificationStatus;
  credentialType: CredentialType;
  verifiedDate: Date;
  expirationDate?: Date | null;
  sourceWebsite: string;
  resultDetails: Record<string, unknown>;
  pdfBuffer?: Buffer | null;
  outputFilename?: string;
  isFlagged?: boolean;
  flagReason?: string;
}

export abstract class BotBase {
  protected db: PrismaClient;

  constructor() {
    this.db = db;
  }

  /**
   * Main entrypoint — called by the BullMQ worker.
   * Handles BotRun status transitions and error handling.
   */
  async run(input: BotRunInput): Promise<void> {
    const { botRunId, providerId } = input;

    // Mark as running
    await this.db.botRun.update({
      where: { id: botRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      // Fetch provider data
      const provider = await this.db.provider.findUniqueOrThrow({
        where: { id: providerId },
        include: { providerType: true, profile: true, licenses: { where: { isPrimary: true } } },
      });

      // Execute the bot logic (implemented by subclass)
      const result = await this.execute(provider, botRunId);

      // Subclasses can short-circuit by setting BotRun.status to REQUIRES_MANUAL
      // (e.g., stub bots). In that case skip VerificationRecord creation and the
      // automatic COMPLETED transition.
      const current = await this.db.botRun.findUniqueOrThrow({
        where: { id: botRunId },
        select: { status: true },
      });
      if (current.status === "REQUIRES_MANUAL") {
        // P3 Gap #20 — let the orchestrator triage the manual escalation.
        await orchestrateBotException(this.db, botRunId).catch((err) =>
          console.error("[Bot] orchestrator (REQUIRES_MANUAL) failed:", err)
        );
        await this.publishResult(providerId, botRunId, "completed", result);
        return;
      }

      // Save PDF to blob if provided
      let pdfBlobUrl: string | undefined;
      let outputFilename: string | undefined;

      if (result.pdfBuffer && result.outputFilename) {
        const blobPath = verificationBlobPath(providerId, result.outputFilename);
        pdfBlobUrl = await uploadDocument({
          blobPath,
          content: result.pdfBuffer,
          contentType: "application/pdf",
          metadata: { providerId, botRunId, botType: this.getBotType() },
        });
        outputFilename = result.outputFilename;
      }

      // Create VerificationRecord
      const verificationRecord = await this.db.verificationRecord.create({
        data: {
          providerId,
          botRunId,
          credentialType: result.credentialType,
          status: result.status,
          verifiedDate: result.verifiedDate,
          expirationDate: result.expirationDate ?? null,
          sourceWebsite: result.sourceWebsite,
          resultDetails: result.resultDetails as Prisma.InputJsonValue,
          pdfBlobUrl: pdfBlobUrl ?? null,
          outputFilename: outputFilename ?? null,
          isFlagged: result.isFlagged ?? false,
          flagReason: result.flagReason ?? null,
        },
      });

      // Mark BotRun as completed
      await this.db.botRun.update({
        where: { id: botRunId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          outputData: {
            verificationRecordId: verificationRecord.id,
            status: result.status,
            isFlagged: result.isFlagged ?? false,
          },
        },
      });

      await writeAuditLog({
        actorId: null,
        actorRole: "SYSTEM",
        action: "bot.run.completed",
        entityType: "BotRun",
        entityId: botRunId,
        providerId,
        afterState: { status: result.status, isFlagged: result.isFlagged },
      });

      // P1 Gap #9 — automatically raise a MonitoringAlert when a bot run
      // produces a flagged verification (sanctions hit, board sanction,
      // license discipline, etc.). This is the single funnel for all
      // bot-driven alerts; webhook ingestion + nightly diff jobs use the
      // same helper.
      if (result.isFlagged) {
        const alertType = this.flaggedAlertType();
        if (alertType) {
          await createMonitoringAlert(this.db, {
            providerId,
            type: alertType,
            severity: "CRITICAL",
            source: `BOT_${this.getBotType()}`,
            title: `${this.getBotType().replace(/_/g, " ")} flagged`,
            description:
              result.flagReason ??
              `Bot ${this.getBotType()} returned a flagged verification.`,
            evidence: {
              botRunId,
              verificationRecordId: verificationRecord.id,
              status: result.status,
              sourceWebsite: result.sourceWebsite,
              flagReason: result.flagReason ?? null,
              resultDetails: result.resultDetails,
            },
          });
        }

        // P3 Gap #20 — orchestrator triages every flagged result so a verdict
        // (and rationale) shows up in the Bot Exceptions queue.
        await orchestrateBotException(this.db, botRunId).catch((err) =>
          console.error("[Bot] orchestrator (FLAGGED) failed:", err)
        );
      }

      // Publish to Redis pub/sub for real-time updates
      await this.publishResult(providerId, botRunId, "completed", result);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Bot:${this.getBotType()}] Error:`, errorMessage);

      // Update BotRun to failed
      const botRun = await this.db.botRun.findUnique({ where: { id: botRunId } });
      const attemptCount = (botRun?.attemptCount ?? 0) + 1;

      await this.db.botRun.update({
        where: { id: botRunId },
        data: {
          status: attemptCount < 3 ? "RETRYING" : "FAILED",
          attemptCount,
          errorMessage,
          completedAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: null,
        actorRole: "SYSTEM",
        action: "bot.run.failed",
        entityType: "BotRun",
        entityId: botRunId,
        providerId,
        afterState: { error: errorMessage, attemptCount },
      });

      // P3 Gap #20 — only triage when this was the FINAL attempt (status
      // = FAILED). Intermediate RETRYING attempts are noise.
      if (attemptCount >= 3) {
        await orchestrateBotException(this.db, botRunId).catch((err) =>
          console.error("[Bot] orchestrator (FAILED) failed:", err)
        );
      }

      await this.publishResult(providerId, botRunId, "failed", null);
      throw error; // Re-throw for BullMQ retry
    }
  }

  /**
   * Publishes bot result to Redis pub/sub for real-time UI updates.
   */
  private async publishResult(
    providerId: string,
    botRunId: string,
    eventType: "completed" | "failed",
    result: BotVerificationResult | null
  ): Promise<void> {
    try {
      const { redis } = await import("../lib/redis.js");
      const channel = `provider:${providerId}:bots`;
      const payload = JSON.stringify({
        event: eventType,
        botRunId,
        botType: this.getBotType(),
        result: result ? { status: result.status, isFlagged: result.isFlagged } : null,
        timestamp: new Date().toISOString(),
      });
      await redis.publish(channel, payload);
    } catch (error) {
      console.error("[Bot] Failed to publish result to Redis:", error);
    }
  }

  /**
   * Returns the BotType enum value for this bot.
   */
  abstract getBotType(): BotType;

  /**
   * The actual bot logic — implemented by each subclass.
   */
  abstract execute(
    provider: BotProviderPayload,
    botRunId: string
  ): Promise<BotVerificationResult>;

  /**
   * Maps this bot's type to a MonitoringAlertType for the auto-alert funnel.
   * Returning null disables alerting for that bot (e.g., manual stubs).
   */
  protected flaggedAlertType(): MonitoringAlertType | null {
    switch (this.getBotType()) {
      case "OIG_SANCTIONS":
        return "OIG_EXCLUSION_ADDED";
      case "SAM_SANCTIONS":
        return "SAM_EXCLUSION_ADDED";
      case "STATE_MEDICAID_EXCLUSION":
        return "STATE_MEDICAID_EXCLUSION_ADDED";
      case "LICENSE_VERIFICATION":
        return "LICENSE_DISCIPLINARY_ACTION";
      case "DEA_VERIFICATION":
        return "DEA_STATUS_CHANGE";
      case "BOARD_NCCPA":
      case "BOARD_ABIM":
      case "BOARD_ABFM":
        return "BOARD_CERT_LAPSED";
      case "NPDB":
        return "NPDB_NEW_REPORT";
      default:
        return null;
    }
  }
}
