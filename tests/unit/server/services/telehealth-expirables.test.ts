/**
 * tests/unit/server/services/telehealth-expirables.test.ts
 *
 * Wave 3.4 — pure-helper coverage for the TelehealthExpirables sync
 * service. The Prisma-touching `syncProvider` / `syncAll` paths are
 * covered separately by integration tests; here we lock down the
 * deterministic helpers so reconciliation never silently drifts.
 */

import { describe, it, expect } from "vitest";
import {
  computeDesiredTelehealthExpirables,
  reconcile,
  sourceSentinel,
  parseSourceSentinel,
} from "@/server/services/telehealth-expirables";

const PROV_A = "00000000-0000-0000-0000-0000000000aa";

describe("sourceSentinel / parseSourceSentinel", () => {
  it("round-trips a key", () => {
    const s = sourceSentinel("cert:abc-123");
    expect(s).toBe("telehealth-expirable://cert:abc-123");
    expect(parseSourceSentinel(s)).toBe("cert:abc-123");
  });

  it("returns null for unrelated values", () => {
    expect(parseSourceSentinel(null)).toBeNull();
    expect(parseSourceSentinel("")).toBeNull();
    expect(parseSourceSentinel("https://example.com/x.png")).toBeNull();
  });
});

describe("computeDesiredTelehealthExpirables", () => {
  it("emits one row per CERTIFIED platform cert with non-null expiry", () => {
    const out = computeDesiredTelehealthExpirables({
      providerId: PROV_A,
      platformCerts: [
        {
          id: "c1",
          platformName: "Teladoc",
          status: "CERTIFIED",
          expiresAt: new Date("2026-12-31"),
        },
        {
          id: "c2",
          platformName: "Amwell",
          status: "PENDING",
          expiresAt: new Date("2026-12-31"),
        },
        {
          id: "c3",
          platformName: "MDLive",
          status: "CERTIFIED",
          expiresAt: null,
        },
      ],
      loq: null,
    });
    expect(out).toHaveLength(1);
    expect(out[0].sourceKey).toBe("cert:c1");
    expect(out[0].expirableType).toBe("TELEHEALTH_PLATFORM_CERT");
  });

  it("emits an IMLC_LOQ row when imlcLoqExpiresAt is set", () => {
    const out = computeDesiredTelehealthExpirables({
      providerId: PROV_A,
      platformCerts: [],
      loq: { imlcLoqExpiresAt: new Date("2027-01-01") },
    });
    expect(out).toHaveLength(1);
    expect(out[0].expirableType).toBe("IMLC_LOQ");
    expect(out[0].sourceKey).toBe(`loq:${PROV_A}`);
  });

  it("returns an empty list when nothing is eligible", () => {
    expect(
      computeDesiredTelehealthExpirables({
        providerId: PROV_A,
        platformCerts: [],
        loq: { imlcLoqExpiresAt: null },
      }),
    ).toEqual([]);
  });
});

describe("reconcile", () => {
  it("creates rows that don't yet exist", () => {
    const desired = [
      {
        expirableType: "TELEHEALTH_PLATFORM_CERT" as const,
        expirationDate: new Date("2026-06-01"),
        sourceKey: "cert:c1",
        label: "Teladoc",
      },
    ];
    const plan = reconcile(desired, []);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("updates rows when expiration date changes", () => {
    const desired = [
      {
        expirableType: "TELEHEALTH_PLATFORM_CERT" as const,
        expirationDate: new Date("2026-12-31"),
        sourceKey: "cert:c1",
        label: "Teladoc",
      },
    ];
    const plan = reconcile(desired, [
      {
        id: "exp-1",
        expirationDate: new Date("2026-06-01"),
        screenshotBlobUrl: sourceSentinel("cert:c1"),
      },
    ]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toEqual([
      { id: "exp-1", desired: desired[0] },
    ]);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("is a no-op when desired matches existing exactly", () => {
    const date = new Date("2026-12-31");
    const desired = [
      {
        expirableType: "TELEHEALTH_PLATFORM_CERT" as const,
        expirationDate: date,
        sourceKey: "cert:c1",
        label: "Teladoc",
      },
    ];
    const plan = reconcile(desired, [
      {
        id: "exp-1",
        expirationDate: new Date(date),
        screenshotBlobUrl: sourceSentinel("cert:c1"),
      },
    ]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("deletes orphaned service-owned rows whose source disappeared", () => {
    const plan = reconcile(
      [],
      [
        {
          id: "exp-stale",
          expirationDate: new Date(),
          screenshotBlobUrl: sourceSentinel("cert:gone"),
        },
      ],
    );
    expect(plan.toDelete).toEqual(["exp-stale"]);
  });

  it("never touches rows that were not created by this service", () => {
    const plan = reconcile(
      [],
      [
        {
          id: "manual-row",
          expirationDate: new Date(),
          screenshotBlobUrl: "https://blob.example/screenshot.png",
        },
      ],
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });
});
