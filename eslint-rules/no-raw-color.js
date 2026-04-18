/**
 * no-raw-color — bans raw color literals in source files.
 *
 * See ADR 0015 (design-system consolidation). The credentialing platform
 * defines its color palette as CSS variables in `src/app/globals.css`,
 * exposed to Tailwind via design tokens (`bg-primary`, `text-card-foreground`,
 * `border-input`, ...). Hard-coding hex / rgb / hsl values bypasses those
 * tokens and silently breaks dark mode.
 *
 * Disallows:
 *   - 3- or 6-digit hex literals  (`#fff`, `#0ea5e9`, `#0EA5E9FF`)
 *   - `rgb(...)` / `rgba(...)`    (`rgb(14,165,233)`)
 *   - `hsl(...)` / `hsla(...)`    (`hsl(217 91% 60%)`)
 *
 * Allows:
 *   - The literal strings `currentColor`, `transparent`, `inherit`, `none`,
 *     `unset`, `initial`, `auto` (case-insensitive).
 *   - String values that don't contain a color literal (most of the codebase).
 *   - Per-line opt-out via `// eslint-disable-next-line no-raw-color/no-raw-color`.
 *
 * Where it looks:
 *   - JSX attribute values:    `<div style={...}>`, `className="bg-[#fff]"`
 *   - Object expressions:      `{ color: "#fff" }`
 *   - Template literals:       `` `color: ${"#fff"}` ``
 *   - Plain string literals.
 */
"use strict";

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RGB_RE = /\brgba?\s*\(/i;
const HSL_RE = /\bhsla?\s*\(/i;

const ALLOWED_KEYWORDS = new Set([
  "currentcolor",
  "transparent",
  "inherit",
  "none",
  "unset",
  "initial",
  "auto",
]);

function findOffense(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const trimmed = value.trim();
  if (ALLOWED_KEYWORDS.has(trimmed.toLowerCase())) return null;
  if (HEX_RE.test(value)) return "hex";
  // Allow rgb()/hsl() forms that wrap a CSS custom property — the canonical
  // shadcn / Tailwind pattern: `hsl(var(--primary))`, `rgb(var(--ring) / 0.4)`.
  if (RGB_RE.test(value) && !/var\s*\(\s*--/.test(value)) return "rgb";
  if (HSL_RE.test(value) && !/var\s*\(\s*--/.test(value)) return "hsl";
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw color literals; use design-token classes instead.",
      category: "Stylistic Issues",
      recommended: false,
    },
    schema: [],
    messages: {
      raw: "Raw color literal `{{value}}` ({{kind}}). Use a design-token class (e.g. `bg-primary`, `text-card-foreground`) defined in src/app/globals.css. See ADR 0015.",
    },
  },
  create(context) {
    function report(node, value, kind) {
      context.report({
        node,
        messageId: "raw",
        data: { value: value.length > 40 ? `${value.slice(0, 40)}…` : value, kind },
      });
    }

    function checkString(node, value) {
      const kind = findOffense(value);
      if (kind) report(node, value, kind);
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") checkString(node, node.value);
      },
      TemplateElement(node) {
        if (node.value && typeof node.value.cooked === "string") {
          checkString(node, node.value.cooked);
        }
      },
      JSXAttribute(node) {
        if (
          node.value &&
          node.value.type === "Literal" &&
          typeof node.value.value === "string"
        ) {
          checkString(node.value, node.value.value);
        }
      },
    };
  },
};
