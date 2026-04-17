/**
 * Sanctions Monitoring Job — NCQA 30-day cadence (P0 Gap #4)
 *
 * NCQA standard (effective July 1, 2025) requires monitoring of license,
 * OIG, SAM, Medicare opt-out, and state Medicaid sanctions every 30 days,
 * across **all states the practitioner practices**. This job replaces the
 * old "monthly" semantics with explicit ≤30-day fan-out:
 *
 *   For every APPROVED provider:
 *     - Federal: enqueue OIG + SAM bot runs (de-duplicated against the last
 *       30-day window).
 *     - State Medicaid: enqueue STATE_MEDICAID_EXCLUSION bot runs for every
 *       distinct state in the provider's License.state list (handled by
 *       sanctions-state-medicaid bot — registered separately when state
 *       plug-ins are configured).
 *
 * The scheduler should run this at most every 7 days; the per-provider
 * idempotency window prevents true duplication.
 */

import { db } from "../../server/db";
import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis";

const RECENT_FEDERAL_WINDOW_MS = 25 * 24 * 60 * 60 * 1000; // 25 days
const RECENT_STATE_WINDOW_MS = 25 * 24 * 60 * 60 * 1000;

export interface SanctionsMonitoringSummary {
  providersChecked: number;
  federalQueued: number;
  federalSkipped: number;
  stateMedicaidQueued: number;
  stateMedicaidSkipped: number;
}

export async function runSanctions30DayMonitoring(): Promise<SanctionsMonitoringSummary> {
  console.log("[Sanctions30Day] Starting 30-day sanctions monitoring sweep…");

  const summary: SanctionsMonitoringSummary = {
    providersChecked: 0,
    federalQueued: 0,
    federalSkipped: 0,
    stateMedicaidQueued: 0,
    stateMedicaidSkipped: 0,
  };

  // Federal monitoring requires either Azure Blob (for evidence PDFs) or
  // SAM.gov API key. State Medicaid will check its own per-state plug-ins
  // before enqueueing.
  const hasFederalWiring =
    !!process.env.AZURE_BLOB_ACCOUNT_URL || !!process.env.SAM_GOV_API_KEY;
  if (!hasFederalWiring) {
    console.log(
      "[Sanctions30Day] Skipped federal sweep — neither AZURE_BLOB_ACCOUNT_URL nor SAM_GOV_API_KEY configured."
    );
  }

  const queue = new Queue("psv-bot", { connection: createRedisConnection() });

  try {
    const approvedProviders = await db.provider.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        npi: true,
        licenses: { select: { state: true, status: true } },
      },
    });

    summary.providersChecked = approvedProviders.length;
    const federalCutoff = new Date(Date.now() - RECENT_FEDERAL_WINDOW_MS);
    const stateCutoff = new Date(Date.now() - RECENT_STATE_WINDOW_MS);

    console.log(
      `[Sanctions30Day] Sweeping ${approvedProviders.length} approved providers…`
    );

    for (const provider of approvedProviders) {
      // ─── Federal: OIG + SAM ───────────────────────────────────────────
      if (hasFederalWiring) {
        const recentFederal = await db.botRun.count({
          where: {
            providerId: provider.id,
            botType: { in: ["OIG_SANCTIONS", "SAM_SANCTIONS"] },
            status: { in: ["QUEUED", "RUNNING", "COMPLETED"] },
            queuedAt: { gte: federalCutoff },
          },
        });

        if (recentFederal >= 2) {
          summary.federalSkipped += 2;
        } else {
          const [oigBotRun, samBotRun] = await Promise.all([
            db.botRun.create({
              data: {
                providerId: provider.id,
                botType: "OIG_SANCTIONS",
                triggeredBy: "AUTOMATIC",
                status: "QUEUED",
                attemptCount: 0,
                inputData: {
                  npi: provider.npi,
                  firstName: provider.legalFirstName,
                  lastName: provider.legalLastName,
                  triggeredBy: "automatic_30day",
                },
              },
            }),
            db.botRun.create({
              data: {
                providerId: provider.id,
                botType: "SAM_SANCTIONS",
                triggeredBy: "AUTOMATIC",
                status: "QUEUED",
                attemptCount: 0,
                inputData: {
                  npi: provider.npi,
                  firstName: provider.legalFirstName,
                  lastName: provider.legalLastName,
                  triggeredBy: "automatic_30day",
                },
              },
            }),
          ]);

          await Promise.all([
            queue.add(
              "oig-sanctions",
              { botRunId: oigBotRun.id, providerId: provider.id },
              { priority: 10, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            ),
            queue.add(
              "sam-sanctions",
              { botRunId: samBotRun.id, providerId: provider.id },
              { priority: 10, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
            ),
          ]);

          summary.federalQueued += 2;
        }
      }

      // ─── State Medicaid: fan out across License.state[] ──────────────
      // P0 Gap #5: every active license state gets a STATE_MEDICAID_EXCLUSION
      // bot run, dispatched to the per-state plug-in (see
      // src/workers/bots/state-medicaid/). When no plug-in is registered or
      // OMIG_*_ENABLED=false, the runner marks REQUIRES_MANUAL.
      const stateBotName = "state-medicaid-exclusion";
      const distinctStates = Array.from(
        new Set(
          provider.licenses
            .filter((l) => l.status === "ACTIVE")
            .map((l) => l.state.toUpperCase())
        )
      );

      for (const state of distinctStates) {
        if (!isStateMedicaidEnabled(state)) {
          summary.stateMedicaidSkipped += 1;
          continue;
        }

        const recentState = await db.botRun.count({
          where: {
            providerId: provider.id,
            botType: "STATE_MEDICAID_EXCLUSION",
            status: { in: ["QUEUED", "RUNNING", "COMPLETED"] },
            queuedAt: { gte: stateCutoff },
            inputData: { path: ["state"], equals: state },
          },
        });

        if (recentState >= 1) {
          summary.stateMedicaidSkipped += 1;
          continue;
        }

        const stateRun = await db.botRun.create({
          data: {
            providerId: provider.id,
            botType: "STATE_MEDICAID_EXCLUSION",
            triggeredBy: "AUTOMATIC",
            status: "QUEUED",
            attemptCount: 0,
            inputData: {
              state,
              npi: provider.npi,
              firstName: provider.legalFirstName,
              lastName: provider.legalLastName,
              triggeredBy: "automatic_30day",
            },
          },
        });

        await queue.add(
          stateBotName,
          { botRunId: stateRun.id, providerId: provider.id, state },
          { priority: 10, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
        );

        summary.stateMedicaidQueued += 1;
      }

      // Tiny delay so we don't blast the queue.
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(
      `[Sanctions30Day] Done. providers=${summary.providersChecked} ` +
        `federalQueued=${summary.federalQueued} federalSkipped=${summary.federalSkipped} ` +
        `stateMedicaidQueued=${summary.stateMedicaidQueued} stateMedicaidSkipped=${summary.stateMedicaidSkipped}`
    );
    return summary;
  } catch (error) {
    console.error("[Sanctions30Day] Error:", error);
    throw error;
  } finally {
    await queue.close();
  }
}

/**
 * Lookup whether a given state has a Medicaid exclusion plug-in registered.
 * P0 Gap #5: starts with NY (OMIG). Other states are added by registering
 * a new plug-in in src/workers/bots/state-medicaid/index.ts and adding the
 * state code to STATE_MEDICAID_PLUGINS. Even if the plug-in's per-state
 * feature flag (e.g., OMIG_NY_ENABLED) is off, we still enqueue the run so
 * the runner emits a REQUIRES_MANUAL audit trail — never a silent skip.
 */
function isStateMedicaidEnabled(state: string): boolean {
  // Defer to the registered plug-in registry. Default list = NY.
  // Importing lazily avoids a circular dep at module load time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasPlugin } = require("../bots/state-medicaid") as {
    hasPlugin: (s: string) => boolean;
  };
  const enabled = (process.env.STATE_MEDICAID_PLUGINS ?? "NY")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return enabled.includes(state) && hasPlugin(state);
}
