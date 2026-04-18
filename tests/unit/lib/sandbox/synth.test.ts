import { describe, expect, it } from "vitest";
import { npiWithChecksum, synthProviderById, synthProviders } from "@/lib/sandbox/synth";

describe("synthProviders", () => {
  it("is deterministic across calls", () => {
    const a = synthProviders();
    const b = synthProviders();
    expect(b).toEqual(a);
  });

  it("returns 25 providers with unique ids and unique NPIs", () => {
    const list = synthProviders();
    expect(list).toHaveLength(25);
    const ids = new Set(list.map((p) => p.id));
    const npis = new Set(list.map((p) => p.npi));
    expect(ids.size).toBe(25);
    expect(npis.size).toBe(25);
  });

  it("includes APPROVED, DENIED, and in-progress statuses", () => {
    const statuses = new Set(synthProviders().map((p) => p.status));
    expect(statuses.has("APPROVED")).toBe(true);
    expect(statuses.has("DENIED")).toBe(true);
    // sanity: at least one non-terminal status
    expect(
      statuses.has("VERIFICATION_IN_PROGRESS") ||
        statuses.has("DOCUMENTS_PENDING") ||
        statuses.has("INVITED") ||
        statuses.has("COMMITTEE_READY"),
    ).toBe(true);
  });

  it("primary state matches the first license state", () => {
    for (const p of synthProviders()) {
      expect(p.licenses[0]?.state).toBe(p.primaryState);
    }
  });
});

describe("synthProviderById", () => {
  it("returns the provider for valid sandbox-N ids", () => {
    expect(synthProviderById("sandbox-1")).not.toBeNull();
    expect(synthProviderById("sandbox-25")).not.toBeNull();
  });

  it("returns null for unknown ids and bad shapes", () => {
    expect(synthProviderById("sandbox-0")).toBeNull();
    expect(synthProviderById("sandbox-26")).toBeNull();
    expect(synthProviderById("sandbox-abc")).toBeNull();
    expect(synthProviderById("nope")).toBeNull();
    expect(synthProviderById("")).toBeNull();
  });
});

describe("npiWithChecksum", () => {
  it("produces 10 digits for all 9-digit bases", () => {
    for (let i = 0; i < 25; i++) {
      const base = (123_456_789 + i).toString().padStart(9, "0");
      const npi = npiWithChecksum(base);
      expect(npi).toMatch(/^\d{10}$/);
      expect(npi.startsWith(base)).toBe(true);
    }
  });

  // Canonical NCQA fake NPI: base 123456789 → checksum 3 → 1234567893
  it("matches the canonical fake NPI 1234567893", () => {
    expect(npiWithChecksum("123456789")).toBe("1234567893");
  });

  it("rejects malformed inputs", () => {
    expect(() => npiWithChecksum("12345678")).toThrow();
    expect(() => npiWithChecksum("1234567890")).toThrow();
    expect(() => npiWithChecksum("abcdefghi")).toThrow();
  });
});
