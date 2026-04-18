/**
 * scripts/qa/iterator-coverage.ts
 *
 * Wave 6 (2026-04-18). Pure helper extracted from
 * `scripts/qa/check-coverage.ts` so the iterator-aware coverage rule
 * can be unit-tested in isolation.
 *
 * Iterator-aware coverage rule (per ADR 0019):
 *   A spec file is treated as an *iterator* over an inventory iff:
 *     1. It imports the inventory JSON via a relative path that ends
 *        in `inventories/<inventory-name>.json`, AND
 *     2. The text below the import contains at least one iteration
 *        construct (`for (`, `.map(`, `.forEach(`, `.filter(`,
 *        `describe.each`, `test.each`, `it.each`).
 *
 *   When both conditions hold, every entry in that inventory is
 *   credited as covered by that spec. This is honest: matrix specs
 *   genuinely exercise every entry. Without this rule the gate could
 *   never reach PASS while there was at least one matrix spec on disk.
 *
 * Anti-weakening (`docs/qa/STANDARD.md` §4.2):
 *   - DO NOT loosen condition 1 to "import anything = cover
 *     everything". The inventory-name pattern is the contract.
 *   - DO NOT loosen condition 2 to "presence of import is enough".
 *     A spec that imports an inventory but never iterates it is not
 *     covering anything; require at least one iteration construct.
 */

export type InventoryName = "route" | "api" | "trpc";

const IMPORT_RES: Record<InventoryName, RegExp> = {
  route: /from\s+["'][^"']*inventories\/route-inventory\.json["']/,
  api: /from\s+["'][^"']*inventories\/api-inventory\.json["']/,
  trpc: /from\s+["'][^"']*inventories\/trpc-inventory\.json["']/,
};

// `\b` does not anchor cleanly before a `.` (both sides are non-word
// characters), so we don't use word boundaries — the substrings here
// are distinctive enough that incidental matches are not a concern.
const ITERATION_RE =
  /(\bfor\s*\(|\.map\s*\(|\.forEach\s*\(|\.filter\s*\(|describe\.each|test\.each|it\.each)/;

/**
 * Returns `true` iff the spec source iterates the named inventory
 * per the rule above.
 */
export function isIteratorSpec(src: string, inventory: InventoryName): boolean {
  const re = IMPORT_RES[inventory];
  const m = re.exec(src);
  if (!m) return false;
  const tail = src.slice(m.index + m[0].length);
  return ITERATION_RE.test(tail);
}
