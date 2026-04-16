import { describe, expect, it } from "vitest";
import type { ProviderStatus } from "@prisma/client";
import {
  STATUS_TRANSITIONS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  assertCanTransition,
  isActive,
  isTerminal,
  InvalidStatusTransitionError,
} from "@/server/services/provider-status";

const ALL_STATUSES: ProviderStatus[] = [
  "INVITED",
  "ONBOARDING_IN_PROGRESS",
  "DOCUMENTS_PENDING",
  "VERIFICATION_IN_PROGRESS",
  "COMMITTEE_READY",
  "COMMITTEE_IN_REVIEW",
  "APPROVED",
  "DENIED",
  "DEFERRED",
  "INACTIVE",
];

describe("provider-status service", () => {
  describe("STATUS_TRANSITIONS", () => {
    it("defines an entry for every ProviderStatus", () => {
      for (const status of ALL_STATUSES) {
        expect(STATUS_TRANSITIONS[status]).toBeDefined();
      }
    });

    it("never allows self-transition even if listed", () => {
      for (const status of ALL_STATUSES) {
        expect(canTransition(status, status)).toBe(false);
      }
    });

    it("allows INVITED -> ONBOARDING_IN_PROGRESS", () => {
      expect(canTransition("INVITED", "ONBOARDING_IN_PROGRESS")).toBe(true);
    });

    it("forbids INVITED -> APPROVED (must go through committee)", () => {
      expect(canTransition("INVITED", "APPROVED")).toBe(false);
    });

    it("allows COMMITTEE_IN_REVIEW -> APPROVED / DENIED / DEFERRED", () => {
      expect(canTransition("COMMITTEE_IN_REVIEW", "APPROVED")).toBe(true);
      expect(canTransition("COMMITTEE_IN_REVIEW", "DENIED")).toBe(true);
      expect(canTransition("COMMITTEE_IN_REVIEW", "DEFERRED")).toBe(true);
    });

    it("permits backing out from COMMITTEE_READY to VERIFICATION_IN_PROGRESS", () => {
      expect(canTransition("COMMITTEE_READY", "VERIFICATION_IN_PROGRESS")).toBe(true);
    });

    it("treats APPROVED as a near-terminal: only INACTIVE is reachable", () => {
      for (const to of ALL_STATUSES) {
        if (to === "INACTIVE") {
          expect(canTransition("APPROVED", to)).toBe(true);
        } else {
          expect(canTransition("APPROVED", to)).toBe(false);
        }
      }
    });

    it("allows re-inviting a denied or inactive provider", () => {
      expect(canTransition("DENIED", "INVITED")).toBe(true);
      expect(canTransition("INACTIVE", "INVITED")).toBe(true);
    });
  });

  describe("assertCanTransition", () => {
    it("does not throw on a valid transition", () => {
      expect(() =>
        assertCanTransition("INVITED", "ONBOARDING_IN_PROGRESS"),
      ).not.toThrow();
    });

    it("throws InvalidStatusTransitionError on an invalid transition", () => {
      expect(() => assertCanTransition("INVITED", "APPROVED")).toThrow(
        InvalidStatusTransitionError,
      );
    });

    it("attaches from/to to the error for logging", () => {
      try {
        assertCanTransition("INVITED", "APPROVED");
      } catch (err) {
        expect((err as InvalidStatusTransitionError).from).toBe("INVITED");
        expect((err as InvalidStatusTransitionError).to).toBe("APPROVED");
        expect((err as InvalidStatusTransitionError).code).toBe(
          "INVALID_STATUS_TRANSITION",
        );
      }
    });
  });

  describe("ACTIVE_STATUSES and TERMINAL_STATUSES", () => {
    it("partition all statuses (no overlap)", () => {
      for (const a of ACTIVE_STATUSES) {
        expect(TERMINAL_STATUSES).not.toContain(a);
      }
    });

    it("together cover every ProviderStatus", () => {
      const covered = new Set([...ACTIVE_STATUSES, ...TERMINAL_STATUSES]);
      for (const status of ALL_STATUSES) {
        expect(covered.has(status)).toBe(true);
      }
    });
  });

  describe("isActive / isTerminal", () => {
    it("INVITED is active, not terminal", () => {
      expect(isActive("INVITED")).toBe(true);
      expect(isTerminal("INVITED")).toBe(false);
    });

    it("APPROVED is terminal, not active", () => {
      expect(isActive("APPROVED")).toBe(false);
      expect(isTerminal("APPROVED")).toBe(true);
    });
  });
});
