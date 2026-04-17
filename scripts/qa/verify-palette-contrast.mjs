#!/usr/bin/env node
/**
 * DEF-0005 verification — applies the WCAG 2.1 relative-luminance + contrast
 * formula (the same formula axe-core's `color-contrast` rule uses) to every
 * foreground/background pair the codebase renders for label text and status
 * pills. Prints PASS/FAIL per pair against the AA 4.5:1 normal-text threshold.
 *
 * This is intentionally dependency-free: it is the math, not a browser check.
 * The browser-side empirical confirmation runs as part of `npm run qa:a11y`
 * in CI; this script exists so any contributor can verify the palette
 * decision without standing up the full Playwright + Postgres stack.
 *
 * Usage:  node scripts/qa/verify-palette-contrast.mjs
 * Exits 0 if every pair >= 4.5:1, exits 1 otherwise.
 */

const AA_NORMAL = 4.5;

// Convert "#rrggbb" -> [0..1, 0..1, 0..1] sRGB then to relative luminance per
// WCAG 2.1 (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
function relLum(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg) {
  const L1 = relLum(fg);
  const L2 = relLum(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// Foregrounds AFTER the tailwind.config.ts overrides land. Each entry is
// keyed by the Tailwind utility class so the table reads naturally.
const FG = {
  "text-gray-400":  "#4b5563", // override (was #9ca3af)
  "text-gray-500":  "#374151", // override (was #6b7280)
  "text-gray-600":  "#4b5563", // unchanged
  "text-gray-700":  "#374151", // unchanged
  "text-yellow-600": "#a16207", // override (was #ca8a04)
  "text-amber-600":  "#b45309", // override (was #d97706)
  "text-orange-600": "#c2410c", // override (was #ea580c)
  "text-green-600":  "#15803d", // override (was #16a34a)
  "text-red-600":    "#b91c1c", // override (was #dc2626 - 4.41:1 just below AA)
  "text-blue-600":   "#2563eb", // unchanged - already passes
  "text-violet-600": "#7c3aed", // unchanged - already passes
  "text-rose-600":   "#be123c", // override (was #e11d48 - 4.28:1 just below AA)
};

// Backgrounds we render label text on.
const BG = {
  "bg-white":     "#ffffff",
  "bg-gray-50":   "#f9fafb",
  "bg-blue-50":   "#eff6ff",
  "bg-violet-50": "#f5f3ff",
  "bg-yellow-50": "#fefce8",
  "bg-amber-50":  "#fffbeb",
  "bg-orange-50": "#fff7ed",
  "bg-red-50":    "#fef2f2",
  "bg-green-50":  "#f0fdf4",
  "bg-rose-50":   "#fff1f2",
};

// Pairs the app actually renders. We verify every gray text on every
// background, plus each color-text on its matching color-50 background
// (the status-pill pattern called out in DEF-0005).
const PAIRS = [
  ...["text-gray-400", "text-gray-500", "text-gray-600", "text-gray-700"]
    .flatMap((fg) => Object.keys(BG).map((bg) => [fg, bg])),
  ["text-yellow-600", "bg-yellow-50"],
  ["text-amber-600",  "bg-amber-50"],
  ["text-orange-600", "bg-orange-50"],
  ["text-green-600",  "bg-green-50"],
  ["text-red-600",    "bg-red-50"],
  ["text-blue-600",   "bg-blue-50"],
  ["text-violet-600", "bg-violet-50"],
  ["text-rose-600",   "bg-rose-50"],
];

let failures = 0;
const rows = PAIRS.map(([fg, bg]) => {
  const ratio = contrast(FG[fg], BG[bg]);
  const pass = ratio >= AA_NORMAL;
  if (!pass) failures += 1;
  return { fg, bg, ratio: ratio.toFixed(2), pass: pass ? "PASS" : "FAIL" };
});

console.log("DEF-0005 palette verification (WCAG 2.1 AA, threshold 4.5:1)");
console.log("─".repeat(70));
for (const r of rows) {
  console.log(
    `  ${r.pass}  ${r.ratio.padStart(6)}:1   ${r.fg.padEnd(18)}  on  ${r.bg}`
  );
}
console.log("─".repeat(70));
console.log(`  ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}  (${rows.length} pairs checked)`);

process.exit(failures === 0 ? 0 : 1);
