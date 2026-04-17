# Risk Register

> Live, lightweight risk log. Update at every status report. Each entry has
> an ID, owner, likelihood, impact, mitigation, contingency, and status.

| ID | Risk | Likelihood | Impact | Owner | Mitigation | Contingency | Status |
|---|---|---|---|---|---|---|---|
| R-001 | PSV source site changes break selectors | High | Medium | Eng Lead | Per-bot smoke tests nightly; selector helpers; alerting | Manual fallback; engineer assigned same day | Open — managed |
| R-002 | NPDB / FSMB cost overrun | Medium | Medium | Sponsor | Subscription cap + monthly review | Throttle CQ frequency; renegotiate | Open — tracked |
| R-003 | Migration data quality from PARCS | High | High | Cred Ops | Bulk import wizard + dedupe + dry-run | Phased migration; manual reconciliation | Open — actively mitigated |
| R-004 | Audit chain corruption | Low | High | Eng Lead | Nightly verifier; DELETE blocked at DB; anchors | Restore from snapshot + reconcile | Open — controls in place |
| R-005 | Provider portal abuse / token leaks | Medium | High | Sec | Single-active token; rate-limit; revoke on attest | Reissue + invalidate; comms to provider | Open — controls in place |
| R-006 | Azure Document Intelligence latency / outage | Medium | Medium | Eng Lead | Retry pool; secondary endpoint Phase 4 | Manual classification fallback | Open — Phase 4 mitigation |
| R-007 | Key rotation downtime (NEXTAUTH_SECRET) | Low | Medium | DevOps | Coordinate window; comms 24h ahead | Force re-login; status page note | Open — managed |
| R-008 | NCQA standard interpretation differences | Medium | Medium | Sec | Engage NCQA SME; document mappings | Address findings via CAP | Open — managed |
| R-009 | Vendor portal MFA changes (DEA, ABMS) | Medium | Medium | Eng Lead | Centralized TOTP; per-bot owner | Manual override path; staff fallback | Open — controls in place |
| R-010 | SFTP partner credential drift | Medium | Low | Cred Ops | Quarterly credential refresh | Re-handshake; legal/contract | Open — managed |
| R-011 | Test coverage erosion | Medium | Medium | QA | Coverage thresholds in CI; PR gate | Refactor sprint | Open — gated |
| R-012 | Person-dependency on one engineer | Medium | High | Eng Lead | Pairing; doc-as-code; runbooks | Hire; cross-train | Open — actively mitigated |
| R-013 | Public API consumer abuse | Medium | Medium | Sec | Per-key rate limits + scopes + audit | Revoke key; rotate; legal | Open — controls in place |
| R-014 | Production single-region outage | Low | High | DevOps | Backups; health checks; status page | Restore in alternate region (Phase 5) | Open — Phase 5 mitigation |
| R-015 | AI hallucination in classification | Medium | Medium | Eng Lead | Decision log; reviewer-required for high-impact | Disable model; revert to manual | Open — controls in place |
| R-016 | Sanctions list source change (URL/format) | Medium | Medium | Eng Lead | Source-version pinning + alerts | Manual lookup until updated | Open — managed |
| R-017 | Data retention policy mismatch | Low | Medium | Sec | Retention matrix + automated purge | Legal review; updated policy | Open — Phase 5 review |

## Closed risks

| ID | Risk | Resolution date | Notes |
|---|---|---|---|
| R-000 | Socket.io cost / instability | 2026-03 | Removed; replaced with polling |

## Cadence

- Risks reviewed weekly by PM with Eng Lead and Sec.
- Material new risks announced at the next status report.
- High-impact / open risks reviewed monthly with Sponsor.
