# CLAUDE.md (pointer)

The AI build-agent prompt lives at the repository root.

→ **[../../CLAUDE.md](../../CLAUDE.md)** — current AI agent guide.

## Why it lives at the root

- Claude Code automatically reads `CLAUDE.md` from the repository root and
  inherited subdirectories.
- Moving it would silently disable that behavior for the entire team.

## Companion

- [../system-prompt.md](../system-prompt.md) — REQUIRED self-contained system
  prompt to **regenerate the application from scratch**. The root
  `CLAUDE.md` and `docs/system-prompt.md` are intentionally different
  documents:
  - `CLAUDE.md` is the day-to-day agent guide for **working on** the
    existing codebase (code style, conventions, where to put things).
  - `system-prompt.md` is the from-scratch rebuild prompt.

When updating the codebase materially, both documents must be kept current
along with the [Development Plan](../development-plan.md).
