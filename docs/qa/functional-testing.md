# Functional Testing Plan

**Audience:** QA engineers.
**Companion:** [Master Test Plan XLSX](../testing/) for the executable plan;
this document explains the per-module focus areas QA must cover.

For each module the table lists the **must-cover** scenarios. UI/UX checks
piggyback on every flow (see [UI/UX Style Guide](../functional/ui-ux-style-guide.md)).

## 1. Authentication & access

- Staff sign-in via Entra (mocked OIDC in CI).
- Staff sign-out invalidates the session cookie.
- Provider magic link: valid → access; expired → 410; reused → 410.
- Public API: missing key → 401; invalid scope → 403; over rate limit → 429.

## 2. Provider directory

- Search by NPI, name, status; combinations work.
- Status transitions follow the documented machine.
- Soft-delete (archive) hides from default list, available with filter.
- Audit row written for create / update / status change.

## 3. Provider intake (provider portal)

- Magic-link flow.
- Each section save triggers field validation errors when invalid.
- Document upload — wrong type rejected; AV-flagged rejected; OK accepted.
- Attestation revokes the invite token.

## 4. PSV bot framework

- Run a successful bot; verify `BotRun`, `RawSourceDoc`, `Verification`.
- Run a failing bot; verify retries x3 then status `MANUAL`.
- Run with stale credential; verify error captured + alert raised.
- Cancel an in-flight bot.

## 5. Sanctions

- Weekly sweep generates expected matches against fixture data.
- Reviewer can confirm / dismiss with note; audit captured.
- Match on existing provider triggers a notification.

## 6. NPDB

- Initial query path success + failure.
- Continuous Query subscription create + cancel.
- Alert on new report → notification + entry on provider.

## 7. Continuous monitoring

- License expiration triggers expirable item.
- FSMB Practitioner Direct alert → notification + audit.

## 8. Credentialing committee

- Schedule meeting; quorum logic.
- Record decisions per provider; lock minutes when signed.
- Auditor can view minutes + linked evidence.

## 9. Recredentialing

- Cycle creates expected items per provider.
- Item statuses progress through machine.
- Completion of all required items triggers committee routing.

## 10. Hospital privileges

- Privilege list per provider; status workflow.
- OPPE / FPPE submissions tied to evaluator role.

## 11. Telehealth state coverage

- Add / remove states; license tied per state.
- Expiration tracked.

## 12. Behavioral health

- BH-specialty PSV satisfies NCQA BH section.

## 13. Peer review

- Intake → finding → RCA → CAP → closeout flow.
- Notifications at each transition.

## 14. Payer enrollment

- Per payer/product create; state machine.
- Bot run associated to enrollment.
- Roster generation pulls correct subset.

## 15. Roster

- Monthly roster includes only active enrollments.
- Attestation required before SFTP push.

## 16. Documents

- Upload → blob → row.
- Download via signed URL only; 5-min expiry.
- Versioning; supersede preserves history.

## 17. AI document classification

- Auto-classify suggestion produces `AiDecisionLog`.
- Reviewer override stored with reason.

## 18. AI governance

- Model card visible per AI feature.
- Decision-log viewer filters by feature, date, reviewer.

## 19. Public REST v1

- Each endpoint: 200 happy path; 401 missing key; 403 wrong scope; 429 over
  rate limit; PHI fields not returned.

## 20. FHIR R4

- `Practitioner` read by id; search by NPI; pagination.
- `Bundle` link.next traversal.
- Conformance against FHIR validator.

## 21. Reports & dashboards

- Each dashboard widget renders for at least 100 fixture providers.
- Exports (CSV / XLSX) match the on-screen totals.

## 22. Communications

- Email send + delivery webhook.
- SMS send + delivery webhook.
- Inbound parse links email reply to provider thread.

## 23. Tasks & notifications

- Assign / reassign tasks; bell updates.
- Notification preferences honored.

## 24. Admin

- API key create / rotate / revoke.
- Role assignment changes effective on next request.
- System settings (cadences) apply to scheduled jobs.

## 25. Audit log

- Every covered action writes an entry with chain hash.
- `npm run audit:verify` reports OK on a clean test DB.
- Tampered row → verifier reports the failure entry.

## 26. Accessibility

- All flows pass `@axe-core/playwright` baseline (no new violations).
- Keyboard navigation works for all primary screens.
- Screen-reader labels present on inputs and icon-only buttons.

## 27. Performance smoke

- Dashboard < 2 s on staging with seed data.
- Provider detail < 1.5 s.
