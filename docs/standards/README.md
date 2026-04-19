# HDPulseAI Standards Propagation — How it works, how to bootstrap a new repo

> Audience: every developer or AI coding agent working in any HDPulseAI
> repository. This document is the operational manual for the
> **propagation mechanism**; the standard itself lives in
> [`../qa/STANDARD.md`](../qa/STANDARD.md).

The HDPulseAI QA Standard is binding on every change in every
HDPulseAI repository, regardless of which IDE or AI agent the
developer is using. This file explains the four-layer propagation
mechanism that makes that binding stick across **Cursor IDE**,
**VSCode + GitHub Copilot**, **Claude Code**, and tool-agnostic agents
(Codex, Cline, Continue, Cody, Windsurf), and how to bootstrap a new
repo (or re-bootstrap a stale one) in one command.

## The four-layer propagation model

Each layer answers one question. The layers are ordered so that the
*more specific* one wins when both are present.

| Layer | File | Reach | Owns |
|---|---|---|---|
| **L1 — In-repo canonical spec** | `docs/qa/STANDARD.md` | this repo | The actual test/build/ship gate, versioned, gateable, auditable. |
| **L2 — Per-repo forwarders** | `.cursor/rules/qa-standard.mdc`, `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.vscode/settings.json` | this repo, every IDE | Tells each AI tool *which* spec to honor (L1 if present, else L3). |
| **L3 — Global Cursor rule** | `~/.cursor/rules/qa-standard-global.mdc` (`alwaysApply: true`) | every Cursor session on this machine | Default standard for any repo that has not yet shipped its own L1. |
| **L4 — Global VSCode user settings** | `%APPDATA%/Code/User/settings.json` + `%APPDATA%/Code/User/prompts/qa-standard.prompt.md` | every VSCode session on this machine | Same defaults as L3 but surfaced through the VSCode + Copilot pipeline. |

### What "wins" when

- **An agent invocation in any HDPulseAI repo:**
  L2 → L1 if L1 exists, else L2 → L3/L4 (depending on which IDE).
- **An agent invocation in a non-HDPulseAI repo on this machine:**
  L3 (Cursor) or L4 (VSCode) — the global defaults catch it.
- **A repo that gets cloned fresh on a different machine:**
  L1 + L2 travel with the repo via git, so the standard applies on the
  new machine even before L3/L4 are installed there.

This is why we keep L1 and L2 in every repo *even though* L3 and L4
already cover everything — L1+L2 is the cross-machine guarantee.

## Bootstrapping a new repo

Two scripts; both are idempotent.

```bash
# from the canonical repo (E_Credentialing):
node scripts/standards/bootstrap-repo.mjs <absolute-path-to-target-repo>
```

For a one-shot sweep of every repo under `C:/Users/admin/development/HDPulseAI/`:

```bash
node scripts/standards/bootstrap-repo.mjs --all
```

The bootstrap drops the L2 forwarders. It is safe to run repeatedly:

- Files marked with `<!-- managed-by: HDPulseAI standards bootstrap -->`
  are overwritten with the current template.
- Existing `AGENTS.md` and `CLAUDE.md` files (without the marker) are
  preserved verbatim; the standard pin is *prepended* with a
  horizontal-rule separator so user content stays untouched.
- `.vscode/settings.json` is merged key-by-key; only the four
  standard-aligned keys are touched, never anything else the
  developer has set.

For the global VSCode side (one-time per machine):

```bash
node scripts/standards/bootstrap-vscode-user.mjs
```

This merges four Copilot keys into the user-level settings.json and
creates `prompts/qa-standard.prompt.md` so VSCode's slash-command
palette exposes `/qa-standard` everywhere.

For the global Cursor side: the file at
`~/.cursor/rules/qa-standard-global.mdc` is shipped manually from
this repo (mirror it from `docs/qa/STANDARD.md` whenever the local
spec bumps a version). On Windows, the path is
`C:\Users\<you>\.cursor\rules\qa-standard-global.mdc`.

## Verifying propagation across the workspace

```bash
node scripts/standards/audit-propagation.mjs
```

Prints the audit table that lives in
[`docs/standards/PROPAGATION-AUDIT.md`](PROPAGATION-AUDIT.md), refreshed
from disk. Each repo column shows whether L1 (in-repo STANDARD.md)
and L2 (each forwarder) are present, current, or stale.

A repo is **fully covered** if every cell is green. A repo is
**covered-via-global** if L1 is absent but L2 forwarders are present
and the global rule (L3) is current — that's the steady state for
repos that are skeletons or do not yet ship a deployable artifact.

## When the standard itself bumps

When `docs/qa/STANDARD.md` in `E_Credentialing` ships a new version
(e.g. v1.3.0 → v1.4.0):

1. Edit `docs/qa/STANDARD.md` in `E_Credentialing`.
2. Mirror the relevant changes into
   `~/.cursor/rules/qa-standard-global.mdc` so L3 stays in sync with
   L1 (or open a PR to update the file in the canonical-rules repo
   if/when you stand one up).
3. Re-run `node scripts/standards/bootstrap-repo.mjs --all` so every
   repo's L2 forwarders pick up any template changes.
4. Re-run `node scripts/standards/bootstrap-vscode-user.mjs` so L4 is
   refreshed.
5. Re-run `node scripts/standards/audit-propagation.mjs` and commit
   the regenerated `docs/standards/PROPAGATION-AUDIT.md`.

The first three steps are mechanical; only step 1 carries judgment.

## Where the prompt library lives

[`docs/standards/PROMPTS.md`](PROMPTS.md) is the canonical prompt
library — exact copy-paste prompts for every "apply / verify" task
class (testing, documentation, UI/UX, accessibility, security,
live-stack, dev-loop performance, defect handling, deploy).
