# Defect Card Index

This folder is the canonical record of every defect surfaced by the
**HDPulseAI QA Standard** Fix-Until-Green loop
(`docs/qa/STANDARD.md` §4.1). Every failing spec or §4 hard-fail condition
opens a card here. Cards are append-only; they are closed (not deleted) when
the fix lands.

## How to open a defect card

1. Pick the next free `DEF-####` number from the table below (zero-padded
   to four digits).
2. Copy [_TEMPLATE.md](_TEMPLATE.md) to `DEF-####.md`.
3. Fill in **Metadata** + **Captured evidence** before you start to fix.
4. Track each Fix-Until-Green attempt in the card. The cap is N=3 per root
   cause (`STANDARD.md` §4.1.1).
5. On close, fill in the **Anti-weakening attestation** and **Closure**
   sections.

Reserved numbers (placeholder records — the actual cards will be authored
when the issues are picked up):

| ID       | Status | Title                                                              | Pillar | Opened     |
|----------|--------|--------------------------------------------------------------------|--------|------------|
| DEF-0001 | Open   | (reserved)                                                         | —      | —          |
| DEF-0002 | Open   | (reserved)                                                         | —      | —          |
| DEF-0003 | Open   | Sidebar `<a>`-inside-`<Link>` hydration mismatch (`src/components/layout/sidebar.tsx`) | A | 2026-04-17 |
| DEF-0004 | Open   | Webpack factory `Cannot read properties of undefined (reading 'call')` after sidebar mount | A | 2026-04-17 |

DEF-0003 and DEF-0004 are the original failures named in `STANDARD.md` §10
that this entire QA Standard exists to prevent from recurring silently.
They will be closed under Phase 0 of the QA plan.
