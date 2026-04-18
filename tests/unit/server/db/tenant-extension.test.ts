/**
 * tests/unit/server/db/tenant-extension.test.ts
 *
 * Wave 5.1 — covers the `injectTenant` pure helper that backs the
 * tenant Prisma extension. We don't spin up a real Prisma client here;
 * the extension just delegates to this function.
 */

import { describe, it, expect } from "vitest";
import { injectTenant } from "../../../../src/server/db/tenant-extension";
import {
  withTenant,
  getTenantId,
  DEFAULT_TENANT_ID,
  dangerouslyBypassTenantScope,
  isBypassScope,
} from "../../../../src/server/db/tenant-context";

describe("injectTenant — read operations", () => {
  it("adds organizationId to an empty where", () => {
    const out = injectTenant("findMany", {}, "org_a");
    expect(out).toEqual({ where: { organizationId: "org_a" } });
  });

  it("preserves an existing where", () => {
    const out = injectTenant(
      "findFirst",
      { where: { status: "APPROVED" } },
      "org_a",
    );
    expect(out).toEqual({
      where: { status: "APPROVED", organizationId: "org_a" },
    });
  });

  it("does not overwrite an explicit organizationId clause", () => {
    const out = injectTenant(
      "findMany",
      { where: { organizationId: "org_b" } },
      "org_a",
    );
    expect(out.where).toEqual({ organizationId: "org_b" });
  });
});

describe("injectTenant — update / delete", () => {
  it("scopes updateMany by tenant", () => {
    const out = injectTenant(
      "updateMany",
      { where: { isActive: true }, data: { isActive: false } },
      "org_x",
    );
    expect(out.where).toEqual({ isActive: true, organizationId: "org_x" });
    expect(out.data).toEqual({ isActive: false });
  });

  it("scopes delete by tenant", () => {
    const out = injectTenant(
      "delete",
      { where: { id: "abc" } },
      "org_y",
    );
    expect(out.where).toEqual({ id: "abc", organizationId: "org_y" });
  });
});

describe("injectTenant — create operations", () => {
  it("injects organizationId on create", () => {
    const out = injectTenant<any>(
      "create",
      { data: { id: "x", legalLastName: "Smith" } },
      "org_a",
    );
    expect(out.data.organizationId).toBe("org_a");
    expect(out.data.legalLastName).toBe("Smith");
  });

  it("respects a caller-provided organizationId on create", () => {
    const out = injectTenant(
      "create",
      { data: { id: "x", organizationId: "org_override" } },
      "org_a",
    );
    expect(out.data.organizationId).toBe("org_override");
  });

  it("injects organizationId on each createMany row", () => {
    const out = injectTenant(
      "createMany",
      { data: [{ id: "1" }, { id: "2", organizationId: "org_keep" }] },
      "org_a",
    );
    expect(out.data[0].organizationId).toBe("org_a");
    expect(out.data[1].organizationId).toBe("org_keep");
  });

  it("upsert: injects on create branch, leaves where alone", () => {
    const out = injectTenant<any>(
      "upsert",
      {
        where: { id: "x" },
        create: { id: "x", legalLastName: "Smith" },
        update: { legalLastName: "Doe" },
      },
      "org_a",
    );
    expect(out.where).toEqual({ id: "x" });
    expect(out.create.organizationId).toBe("org_a");
    expect(out.update).toEqual({ legalLastName: "Doe" });
  });
});

describe("AsyncLocalStorage tenant context", () => {
  it("falls back to DEFAULT_TENANT_ID outside a withTenant block", () => {
    expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
  });

  it("returns the active tenant inside a withTenant block", () => {
    const inner = withTenant({ organizationId: "org_widget" }, () =>
      getTenantId(),
    );
    expect(inner).toBe("org_widget");
    // And reverts after the block.
    expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
  });

  it("dangerouslyBypassTenantScope marks the scope as bypass", () => {
    let observed: string | null = null;
    let bypass = false;
    dangerouslyBypassTenantScope(() => {
      observed = getTenantId();
      const scope = { organizationId: getTenantId() };
      bypass = isBypassScope(scope);
    });
    expect(observed).toBe("__bypass__");
    expect(bypass).toBe(true);
  });
});
