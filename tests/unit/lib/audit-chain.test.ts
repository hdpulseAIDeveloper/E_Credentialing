/**
 * Pure-function coverage of the audit hash-chain computation used by
 * src/lib/audit.ts. We re-implement the canonicalization + HMAC here
 * and assert its properties; the integration test in
 * tests/integration/audit-chain.test.ts exercises the full INSERT +
 * UPDATE path against a real Postgres with the trigger installed.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

const KEY = "test-key-must-be-at-least-32-characters-long";

type Row = {
  sequence: bigint;
  timestamp: Date;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  providerId: string | null;
  beforeState: unknown;
  afterState: unknown;
  metadata: unknown;
};

function canonicalize(row: Row): string {
  return JSON.stringify({
    sequence: row.sequence.toString(),
    ts: row.timestamp.toISOString(),
    actor: row.actorId,
    role: row.actorRole,
    action: row.action,
    entity: `${row.entityType}:${row.entityId}`,
    provider: row.providerId,
    before: row.beforeState ?? null,
    after: row.afterState ?? null,
    meta: row.metadata ?? null,
  });
}

function computeHash(previousHash: string | null, canonical: string): string {
  const h = createHmac("sha256", KEY);
  h.update(previousHash ?? "GENESIS");
  h.update("\x1e");
  h.update(canonical);
  return h.digest("hex");
}

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    sequence: BigInt(1),
    timestamp: new Date("2026-04-16T12:00:00Z"),
    actorId: "user-1",
    actorRole: "SPECIALIST",
    action: "provider.updated",
    entityType: "Provider",
    entityId: "prov-1",
    providerId: "prov-1",
    beforeState: { status: "INVITED" },
    afterState: { status: "IN_PROGRESS" },
    metadata: null,
    ...overrides,
  };
}

describe("audit hash chain", () => {
  it("produces a hex-encoded SHA-256 digest", () => {
    const hash = computeHash(null, canonicalize(makeRow()));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for identical input", () => {
    const row = makeRow();
    const a = computeHash("prev", canonicalize(row));
    const b = computeHash("prev", canonicalize(row));
    expect(a).toBe(b);
  });

  it("changes when previous_hash changes", () => {
    const row = makeRow();
    const a = computeHash(null, canonicalize(row));
    const b = computeHash("something-else", canonicalize(row));
    expect(a).not.toBe(b);
  });

  it("changes when any chain-input field changes", () => {
    const base = makeRow();
    const h = computeHash(null, canonicalize(base));
    const mutations: Array<Partial<Row>> = [
      { sequence: BigInt(2) },
      { timestamp: new Date("2026-04-16T12:00:01Z") },
      { actorId: "user-2" },
      { actorRole: "MANAGER" },
      { action: "provider.deleted" },
      { entityType: "Document" },
      { entityId: "prov-2" },
      { providerId: null },
      { beforeState: { status: "OTHER" } },
      { afterState: { status: "OTHER" } },
      { metadata: { note: "x" } },
    ];
    for (const patch of mutations) {
      const h2 = computeHash(null, canonicalize(makeRow(patch)));
      expect(h2).not.toBe(h);
    }
  });

  it("uses GENESIS marker for the first row so a NULL previous_hash is distinguishable", () => {
    const row = makeRow();
    const withNull = computeHash(null, canonicalize(row));
    const withEmpty = computeHash("", canonicalize(row));
    expect(withNull).not.toBe(withEmpty);
  });

  it("detects a swapped record (replay) because its sequence would not match its canonical position", () => {
    const rowA = makeRow({ sequence: BigInt(1) });
    const rowB = makeRow({ sequence: BigInt(2), action: "provider.approved" });
    const hashA = computeHash(null, canonicalize(rowA));
    const hashB = computeHash(hashA, canonicalize(rowB));

    const replayAasB = computeHash(hashA, canonicalize(rowA));
    expect(replayAasB).not.toBe(hashB);
  });
});
