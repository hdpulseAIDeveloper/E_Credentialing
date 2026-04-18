# Per-screen card: `/changelog`

| Field | Value |
| --- | --- |
| Route(s) | `/changelog` (HTML), `/changelog.rss` (RSS 2.0) |
| Source file | `src/app/changelog/page.tsx`, `src/app/changelog.rss/route.ts` |
| Dynamic | no (Server Component reading `docs/changelog/public.md`) |
| Group | public / marketing |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none. Source is curated Markdown reviewed in PR. |

## Key actions / mutations

- No mutations. Read-only public surface.
- One outbound link to `/changelog.rss` for RSS subscription.
- Anchor links per release (`#v1.5.0`, etc.) are stable.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A, every static route)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
- `tests/unit/lib/changelog/parser.test.ts` (8 tests, source format)
- `tests/unit/lib/changelog/rss.test.ts` (7 tests, RSS rendering + escaping)
- See [Pillar U](../per-pillar/pillar-u-changelog.md) for full coverage map.

## Linked OpenAPI / tRPC procedures

None. The page reads a static Markdown file shipped with the bundle;
there is no tRPC or REST call.

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.5 (parser + RSS unit tests green; manual smoke of
`/changelog` and `/changelog.rss` confirmed; see ADR 0018).
