/**
 * no-tenant-bypass — bans `dangerouslyBypassTenantScope` outside the
 * approved internal directory.
 *
 * Per ADR 0014 (multi-tenancy shim) the bypass helper exists for narrow,
 * audited operations like cross-tenant aggregations, billing roll-ups,
 * and the super-admin org-CRUD endpoint. Importing it from a tRPC router
 * or a UI component is a data-leak waiting to happen, so we lock the
 * import path with this lint rule.
 *
 * Allowed paths (case-sensitive, normalized to forward slashes):
 *   src/server/db/internal/**       (the only legitimate caller)
 *   tests/unit/server/db/**         (unit tests for the bypass behavior)
 *   tests/e2e/tenancy/**            (end-to-end Pillar Q specs)
 *
 * Anything else triggers a hard error.
 */
"use strict";

const ALLOWED_PATTERNS = [
  /(?:^|[\\/])src[\\/]server[\\/]db[\\/]internal[\\/]/,
  /(?:^|[\\/])tests[\\/]unit[\\/]server[\\/]db[\\/]/,
  /(?:^|[\\/])tests[\\/]e2e[\\/]tenancy[\\/]/,
];

function isAllowedFile(filename) {
  if (!filename) return false;
  return ALLOWED_PATTERNS.some((re) => re.test(filename));
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow imports of dangerouslyBypassTenantScope outside the approved internal directory.",
      category: "Possible Errors",
      recommended: true,
    },
    schema: [],
    messages: {
      banned:
        "dangerouslyBypassTenantScope can only be used inside src/server/db/internal/** — the bypass is a data-leak vector. See ADR 0014.",
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (isAllowedFile(filename)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value;
        if (typeof source !== "string") return;
        if (!/tenant-context$|tenant-context\.[tj]sx?$/.test(source)) return;
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported &&
            spec.imported.name === "dangerouslyBypassTenantScope"
          ) {
            context.report({
              node: spec,
              messageId: "banned",
            });
          }
        }
      },
      Identifier(node) {
        // Catch dynamic require / shorthand re-export patterns.
        if (
          node.name === "dangerouslyBypassTenantScope" &&
          node.parent &&
          (node.parent.type === "MemberExpression" ||
            node.parent.type === "Property") &&
          node.parent.computed === false
        ) {
          // Only flag declarations that look like re-export attempts.
          if (
            node.parent.type === "Property" &&
            node.parent.parent &&
            node.parent.parent.type === "ObjectExpression" &&
            node.parent.parent.parent &&
            node.parent.parent.parent.type === "ExportDefaultDeclaration"
          ) {
            context.report({ node, messageId: "banned" });
          }
        }
      },
    };
  },
};
