/**
 * src/server/services/telehealth-expirables.ts
 *
 * Wave 3.4 — sync per-platform telehealth certifications and the IMLC
 * Letter of Qualification onto the central `/expirables` board so staff
 * have ONE deadline radar for everything that ages.
 *
 * Two `ExpirableType` values were added in
 * `prisma/migrations/20260418000000_add_telehealth_expirable_types/`:
 *
 *   - TELEHEALTH_PLATFORM_CERT  (one row per `TelehealthPlatformCert`
 *                                in `CERTIFIED` status with a non-null
 *                                `expiresAt`)
 *   - IMLC_LOQ                  (one row per provider whose
 *                                `ProviderProfile.imlcLoqExpiresAt`
 *                                is non-null)
 *
 * Sync semantics:
 *
 *   - Reconciliation is per-provider. For each provider we compute the
 *     desired set of (type, expirationDate) Expirable rows and
 *     reconcile against what's currently in the DB.
 *   - We never delete unrelated Expirables — only the rows owned by
 *     this service for the same `(providerId, expirableType)` pair
 *     whose source key no longer exists.
 *   - Idempotent. Running the sync twice produces zero churn.
 *
 * Pure helpers (`computeDesiredTelehealthExpirables`) are factored out
 * so unit tests don't need a real database.
 *
 * Trigger surfaces:
 *   - Nightly worker job (`runTelehealthExpirablesSync`) called from
 *     `runTelehealthComplianceCheck` so the platform cert / LoQ
 *     monitoring alerts and the Expirables rows stay in lockstep.
 *   - On-demand staff manager mutation
 *     (`telehealth.syncExpirables`).
 */

import type { Prisma, PrismaClient, ExpirableType } from "@prisma/client";

// ─── Pure helpers (testable without Prisma) ─────────────────────────────────

export interface PlatformCertSource {
  /** Provider-scoped unique cert id (uuid). */
  id: string;
  platformName: string;
  status: string;
  expiresAt: Date | null;
}

export interface LoqSource {
  imlcLoqExpiresAt: Date | null;
}

export interface DesiredExpirable {
  expirableType: ExpirableType;
  expirationDate: Date;
  /**
   * Stable, per-provider key. Used to match an Expirable row back to
   * the source record so re-syncing is idempotent. Stored in the
   * matching Expirable's `screenshotBlobUrl` field as a sentinel
   * `telehealth-expirable://<key>` URI — `screenshotBlobUrl` is the
   * only free-form string field on Expirable today; once a proper
   * source-key column lands (Wave 5.x), the sentinel goes away.
   */
  sourceKey: string;
  /** Nice-to-have label echoed into audit rows. */
  label: string;
}

const SENTINEL_PREFIX = "telehealth-expirable://";

/** Build the sentinel URI used to mark service-owned Expirable rows. */
export function sourceSentinel(key: string): string {
  return `${SENTINEL_PREFIX}${key}`;
}

/** Recover the source key from a sentinel URI. Returns null if not ours. */
export function parseSourceSentinel(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(SENTINEL_PREFIX)) return null;
  return value.slice(SENTINEL_PREFIX.length);
}

/**
 * Pure: given the source records for ONE provider, return the set of
 * Expirable rows we'd like to see in the database.
 */
export function computeDesiredTelehealthExpirables(input: {
  providerId: string;
  platformCerts: PlatformCertSource[];
  loq: LoqSource | null;
}): DesiredExpirable[] {
  const out: DesiredExpirable[] = [];

  for (const cert of input.platformCerts) {
    if (cert.status !== "CERTIFIED" || !cert.expiresAt) continue;
    out.push({
      expirableType: "TELEHEALTH_PLATFORM_CERT" as ExpirableType,
      expirationDate: cert.expiresAt,
      sourceKey: `cert:${cert.id}`,
      label: `${cert.platformName} platform certification`,
    });
  }

  if (input.loq?.imlcLoqExpiresAt) {
    out.push({
      expirableType: "IMLC_LOQ" as ExpirableType,
      expirationDate: input.loq.imlcLoqExpiresAt,
      sourceKey: `loq:${input.providerId}`,
      label: "IMLC Letter of Qualification",
    });
  }

  return out;
}

/**
 * Pure: given desired vs. existing rows for one (provider, expirableType),
 * return a `{toCreate, toUpdate, toDelete}` plan. The reconciler matches
 * by `sourceKey` (parsed from the existing row's sentinel field).
 */
export function reconcile(
  desired: DesiredExpirable[],
  existing: Array<{
    id: string;
    expirationDate: Date;
    screenshotBlobUrl: string | null;
  }>,
): {
  toCreate: DesiredExpirable[];
  toUpdate: Array<{ id: string; desired: DesiredExpirable }>;
  toDelete: string[];
} {
  const existingByKey = new Map<
    string,
    { id: string; expirationDate: Date; screenshotBlobUrl: string | null }
  >();
  const orphanIds: string[] = [];
  for (const e of existing) {
    const key = parseSourceSentinel(e.screenshotBlobUrl);
    if (!key) {
      // A row in the same (provider, type) bucket that we did NOT
      // create — leave it alone.
      continue;
    }
    existingByKey.set(key, e);
  }

  const desiredKeys = new Set(desired.map((d) => d.sourceKey));
  for (const [key, row] of existingByKey) {
    if (!desiredKeys.has(key)) orphanIds.push(row.id);
  }

  const toCreate: DesiredExpirable[] = [];
  const toUpdate: Array<{ id: string; desired: DesiredExpirable }> = [];

  for (const d of desired) {
    const ex = existingByKey.get(d.sourceKey);
    if (!ex) {
      toCreate.push(d);
      continue;
    }
    if (ex.expirationDate.getTime() !== d.expirationDate.getTime()) {
      toUpdate.push({ id: ex.id, desired: d });
    }
  }

  return { toCreate, toUpdate, toDelete: orphanIds };
}

// ─── Service ────────────────────────────────────────────────────────────────

export interface TelehealthExpirablesSyncResult {
  scanned: number;
  created: number;
  updated: number;
  deleted: number;
}

/**
 * Compute the next-check date for an Expirable row from its expiration.
 * Mirrors the existing convention in `expirable.ts` (90 days before
 * expiry, clamped to today if expiry is already in the past).
 */
function nextCheckFromExpiry(expiry: Date): Date {
  const candidate = new Date(expiry);
  candidate.setDate(candidate.getDate() - 90);
  const now = new Date();
  return candidate.getTime() > now.getTime() ? candidate : now;
}

export class TelehealthExpirablesService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Reconcile a single provider. Safe to call from the staff UI as well
   * as the nightly worker.
   */
  async syncProvider(providerId: string): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    const [certs, profile, existing] = await Promise.all([
      this.db.telehealthPlatformCert.findMany({
        where: { providerId },
        select: {
          id: true,
          platformName: true,
          status: true,
          expiresAt: true,
        },
      }),
      this.db.providerProfile.findUnique({
        where: { providerId },
        select: { imlcLoqExpiresAt: true },
      }),
      this.db.expirable.findMany({
        where: {
          providerId,
          expirableType: { in: ["TELEHEALTH_PLATFORM_CERT", "IMLC_LOQ"] },
        },
        select: {
          id: true,
          expirableType: true,
          expirationDate: true,
          screenshotBlobUrl: true,
        },
      }),
    ]);

    const desired = computeDesiredTelehealthExpirables({
      providerId,
      platformCerts: certs,
      loq: profile,
    });

    const result = { created: 0, updated: 0, deleted: 0 };

    // Reconcile per-bucket so the (provider, type) match is exact.
    for (const type of ["TELEHEALTH_PLATFORM_CERT", "IMLC_LOQ"] as const) {
      const desiredBucket = desired.filter((d) => d.expirableType === type);
      const existingBucket = existing.filter((e) => e.expirableType === type);
      const plan = reconcile(desiredBucket, existingBucket);

      for (const c of plan.toCreate) {
        await this.db.expirable.create({
          data: {
            providerId,
            expirableType: c.expirableType,
            expirationDate: c.expirationDate,
            nextCheckDate: nextCheckFromExpiry(c.expirationDate),
            renewalCadenceDays: 365,
            status: "CURRENT",
            screenshotBlobUrl: sourceSentinel(c.sourceKey),
          },
        });
        result.created += 1;
      }
      for (const u of plan.toUpdate) {
        await this.db.expirable.update({
          where: { id: u.id },
          data: {
            expirationDate: u.desired.expirationDate,
            nextCheckDate: nextCheckFromExpiry(u.desired.expirationDate),
            // Reset to CURRENT on a refresh; the nightly recompute will
            // bump it back to EXPIRING_SOON / EXPIRED if appropriate.
            status: "CURRENT",
          },
        });
        result.updated += 1;
      }
      if (plan.toDelete.length > 0) {
        await this.db.expirable.deleteMany({
          where: { id: { in: plan.toDelete } },
        });
        result.deleted += plan.toDelete.length;
      }
    }

    return result;
  }

  /**
   * Reconcile every provider that has a telehealth surface (any
   * platform cert OR a non-null LoQ expiry).
   */
  async syncAll(): Promise<TelehealthExpirablesSyncResult> {
    const summary: TelehealthExpirablesSyncResult = {
      scanned: 0,
      created: 0,
      updated: 0,
      deleted: 0,
    };
    const candidates = await this.db.provider.findMany({
      where: {
        OR: [
          { telehealthPlatformCerts: { some: {} } },
          { profile: { imlcLoqExpiresAt: { not: null } } },
        ],
      } as Prisma.ProviderWhereInput,
      select: { id: true },
    });
    for (const p of candidates) {
      summary.scanned += 1;
      try {
        const r = await this.syncProvider(p.id);
        summary.created += r.created;
        summary.updated += r.updated;
        summary.deleted += r.deleted;
      } catch (err) {
        console.error(
          `[TelehealthExpirablesSync] failed for provider ${p.id}:`,
          err,
        );
      }
    }
    return summary;
  }
}
