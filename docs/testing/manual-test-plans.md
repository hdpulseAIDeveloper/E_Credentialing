# Manual Test Plans

Manual, scripted test plans used for UAT sign-off before major releases. Automated coverage is the primary gate; these plans confirm that real users can complete real work.

## When to run

- Before every minor release that touches a top-10 page.
- After any infrastructure change (DB, Redis, blob container, Auth.js provider swap).
- As part of the annual pen test retest.

## Plans

### 1. New provider end-to-end

**Owner**: Credentialing Manager (test account).
**Duration**: 45 min.

Steps:

1. Sign in with Microsoft 365.
2. Create a new provider (MD, NY-licensed).
3. Send invite.
4. Sign out; open the invite link in an incognito window.
5. Fill every section; upload test documents.
6. Attest; confirm token is revoked.
7. Sign back in as Manager; verify the provider state.
8. Trigger license, DEA, and NPDB bots.
9. Verify bot evidence PDFs are downloadable via the authenticated route.
10. Mark PSV complete; send to committee.
11. Sign in as committee member; review agenda; approve.
12. Confirm the provider moves to "Approved" and enrollment tasks appear.

Success criteria: no errors, every audit entry present, PHI encrypted in DB, SAS URLs short-lived.

### 2. Monthly roster submission

Owner: Roster Manager.
Duration: 30 min.

Steps:

1. Open the roster draft for a test payer.
2. Review flagged providers; resolve by editing source data.
3. Export CSV; open in Excel; confirm all rows valid.
4. Submit to payer (test endpoint / SFTP).
5. Record acknowledgement.

### 3. Recredentialing cycle

Owner: Credentialing Specialist.
Duration: 30 min.

Steps:

1. Identify a provider with recred due in 30 days.
2. Start cycle; verify abbreviated application is created.
3. Sign in as provider via the magic link; complete the abbreviated form.
4. Re-run PSV; verify all evidence refreshed.
5. Submit to committee.
6. Approve; verify the cycle completes with a new anniversary date.

### 4. Sanctions hit

Owner: Specialist + Compliance.
Duration: 20 min.

Steps:

1. Manually trigger an OIG check for a test provider with a seeded "hit".
2. Verify the hit is flagged on the provider page.
3. Follow the confirmed-sanction workflow (committee action, provider status change, payer notification).
4. Verify audit entries for every step.

### 5. API consumer journey

Owner: Admin + external test consumer.
Duration: 30 min.

Steps:

1. Admin creates an API key with `providers:read` scope.
2. Consumer authenticates with the key; hits `GET /api/v1/providers`.
3. Consumer hits `GET /api/v1/providers/{id}` for a known provider.
4. Consumer hits `GET /api/fhir/Practitioner`.
5. Verify no PHI in any response.
6. Exceed rate limit; verify 429 with `retry-after`.
7. Admin revokes the key; consumer requests return 401.

### 6. Committee session

Owner: Chair + Manager.
Duration: 45 min.

Steps:

1. Manager generates an agenda with 5 providers.
2. Chair opens the committee dashboard.
3. Record decisions (approve 3, table 1, conditionally approve 1 with notes).
4. Finalize session.
5. Generate minutes; attest.
6. Verify post-meeting state matches decisions.

### 7. Incident drill

Owner: Operations + Security.
Duration: 60 min.

Simulate each of:

- Worker container crash (confirm restart and retries).
- Postgres unavailable (confirm readiness probe turns 503).
- Blob storage unavailable (confirm user-facing message; no data loss).
- Single PSV site down (confirm bot marks FAILED, retries later).

### 8. Accessibility manual pass

Owner: QA with assistive tech.
Duration: 60 min.

Tested on the top-10 pages with:

- Keyboard only
- NVDA screen reader
- 200% zoom
- Forced-colors mode

## Sign-off

Each plan has a sign-off sheet stored with the release artifacts. A release cannot be tagged without all sign-offs.
