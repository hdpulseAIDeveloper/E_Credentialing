/**
 * State Medicaid Exclusion runner (P0 Gap #5)
 *
 * Invoked by the BullMQ "state-medicaid-exclusion" job. Looks up the
 * registered plug-in for the state, performs the lookup, persists a
 * SanctionsCheck row, uploads any evidence PDF to Azure Blob, and updates
 * the BotRun status.
 *
 * If no plug-in is registered for the state, or the plug-in is not yet
 * enabled (e.g., OMIG_NY_ENABLED=false), the BotRun is marked
 * REQUIRES_MANUAL with a clear message — never silently "clear".
 */

import { db } from "../../../server/db";
import { uploadDocument } from "../../../lib/azure/blob";
import { verificationBlobPath } from "../../../lib/blob-naming";
import { writeAuditLog } from "../../../lib/audit";
import { redis } from "../../../lib/redis";
import { getPlugin, hasPlugin } from "./index";

export interface StateMedicaidJobInput {
  botRunId: string;
  providerId: string;
  state: string;
}

export async function runStateMedicaidExclusion(
  input: StateMedicaidJobInput
): Promise<void> {
  const { botRunId, providerId, state } = input;
  const stateUpper = state.toUpperCase();

  await db.botRun.update({
    where: { id: botRunId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const provider = await db.provider.findUniqueOrThrow({
      where: { id: providerId },
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        npi: true,
      },
    });

    const plugin = getPlugin(stateUpper);

    if (!plugin) {
      const message =
        `No state Medicaid exclusion plug-in is registered for ${stateUpper}. ` +
        `Staff should manually screen the state Medicaid exclusion list and ` +
        `upload the evidence under Documents > Sanctions > ${stateUpper} Medicaid.`;
      await markRequiresManual(botRunId, providerId, stateUpper, message);
      return;
    }

    const result = await plugin.lookup({
      npi: provider.npi,
      firstName: provider.legalFirstName,
      lastName: provider.legalLastName,
      state: stateUpper,
    });

    let pdfBlobUrl: string | null = null;
    if (result.evidencePdfBuffer && result.evidencePdfFilename) {
      const blobPath = verificationBlobPath(
        providerId,
        result.evidencePdfFilename
      );
      pdfBlobUrl = await uploadDocument({
        blobPath,
        content: result.evidencePdfBuffer,
        contentType: "application/pdf",
        metadata: {
          providerId,
          botRunId,
          source: result.source,
          state: stateUpper,
        },
      });
    }

    if (result.status === "REQUIRES_MANUAL") {
      await markRequiresManual(
        botRunId,
        providerId,
        stateUpper,
        result.message ??
          `${plugin.sourceName} screening requires manual completion.`
      );
      return;
    }

    if (result.status === "ERROR") {
      throw new Error(
        result.message ??
          `${plugin.sourceName} lookup failed for an unknown reason.`
      );
    }

    // status === "CLEAR" or "EXCLUDED"
    const sanctionsResult = result.status === "EXCLUDED" ? "FLAGGED" : "CLEAR";
    const isFlagged = sanctionsResult === "FLAGGED";

    await db.sanctionsCheck.create({
      data: {
        providerId,
        source: "STATE_MEDICAID",
        runDate: new Date(),
        triggeredBy: "AUTOMATIC_30DAY",
        result: sanctionsResult,
        exclusionType: result.exclusionDetails?.type ?? null,
        exclusionEffectiveDate: result.exclusionDetails?.effectiveDate
          ? new Date(result.exclusionDetails.effectiveDate)
          : null,
        exclusionBasis: result.exclusionDetails?.basis ?? null,
        pdfBlobUrl,
        botRunId,
      },
    });

    await db.botRun.update({
      where: { id: botRunId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        outputData: {
          state: stateUpper,
          source: result.source,
          sourceUrl: result.sourceUrl,
          status: result.status,
          matchCount: result.matchCount,
          isFlagged,
        },
      },
    });

    await writeAuditLog({
      actorId: null,
      actorRole: "SYSTEM",
      action: "bot.state_medicaid.completed",
      entityType: "BotRun",
      entityId: botRunId,
      providerId,
      afterState: {
        state: stateUpper,
        source: result.source,
        status: result.status,
        isFlagged,
      },
    });

    try {
      await redis.publish(
        `provider:${providerId}:bots`,
        JSON.stringify({
          event: "completed",
          botRunId,
          botType: "STATE_MEDICAID",
          state: stateUpper,
          result: { status: result.status, isFlagged },
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error("[StateMedicaid] Redis publish failed:", err);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[StateMedicaid:${stateUpper}] BotRun ${botRunId} failed:`,
      errorMessage
    );

    const botRun = await db.botRun.findUnique({ where: { id: botRunId } });
    const attemptCount = (botRun?.attemptCount ?? 0) + 1;
    await db.botRun.update({
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
      action: "bot.state_medicaid.failed",
      entityType: "BotRun",
      entityId: botRunId,
      providerId,
      afterState: { state: stateUpper, error: errorMessage, attemptCount },
    });

    throw error;
  }

  // Helper: side-effect only used inside this function scope
  async function markRequiresManual(
    runId: string,
    pid: string,
    st: string,
    message: string
  ) {
    await db.botRun.update({
      where: { id: runId },
      data: {
        status: "REQUIRES_MANUAL",
        errorMessage: message,
        completedAt: new Date(),
        outputData: {
          state: st,
          requiresManual: true,
          pluginRegistered: hasPlugin(st),
          message,
        },
      },
    });

    await writeAuditLog({
      actorId: null,
      actorRole: "SYSTEM",
      action: "bot.state_medicaid.manual_required",
      entityType: "BotRun",
      entityId: runId,
      providerId: pid,
      afterState: {
        state: st,
        message,
        pluginRegistered: hasPlugin(st),
      },
    });
  }
}
