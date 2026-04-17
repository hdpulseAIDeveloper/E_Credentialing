# Product Change Log (pointer)

The product change log lives at the repository root by convention
([Keep a Changelog](https://keepachangelog.com)).

→ **[../CHANGELOG.md](../CHANGELOG.md)** — current product change log.

## Why it lives at the root

- Tooling (release-please, GitHub Releases, dependency scanners) expects
  `CHANGELOG.md` at the repo root.
- Moving it would break automation and external consumers who link to
  `https://github.com/<org>/<repo>/blob/master/CHANGELOG.md`.

## Companion

- [pm/change-log-policy.md](pm/change-log-policy.md) — how the change log is
  maintained, severity levels, and release process.
- [pm/decision-log.md](pm/decision-log.md) — non-technical decisions.
- [dev/adr/](dev/adr/) — architecture decision records.
