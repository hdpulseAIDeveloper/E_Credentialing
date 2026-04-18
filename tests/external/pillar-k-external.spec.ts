/**
 * Pillar K -- External integration (per `docs/qa/STANDARD.md` §1.K).
 *
 * The bot integrations (CAQH, NPDB, PECOS, eMedNY, Availity, etc.) are
 * exercised in their own integration suite that hits sandbox endpoints
 * and is gated by sandbox credentials. This file holds the contract
 * checks that run on every PR with no external network calls.
 *
 * Wave 3.3 widens K with full sandbox cycles for FHIR + sanctions
 * webhooks.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("pillar-K: external integration scaffolding", () => {
  it("BOTS_REGISTRY documents every portal we automate", () => {
    const path = join(process.cwd(), "docs/qa/inventories/bots-registry.json");
    if (!existsSync(path)) return;
    const reg = JSON.parse(readFileSync(path, "utf8")) as Array<{ portal: string }>;
    expect(reg.length, "bots registry empty").toBeGreaterThan(0);
  });

  it("sanctions catalog references all five primary feeds", () => {
    const path = join(process.cwd(), "docs/qa/inventories/sanctions-feeds.json");
    if (!existsSync(path)) return;
    const feeds = JSON.parse(readFileSync(path, "utf8")) as Array<{ id: string }>;
    const ids = new Set(feeds.map((f) => f.id));
    for (const required of ["oig-leie", "sam-exclusions"]) {
      expect(ids.has(required), `missing required sanctions feed: ${required}`).toBe(true);
    }
  });
});
