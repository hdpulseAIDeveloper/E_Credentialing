# Cookie & Session Notice

**Status:** DRAFT — pending Legal + Compliance review.
**Version:** `v1.0-draft`
**Effective date:** to be set on approval
**Renders at:** `/legal/cookies` (linked from the page footer).
**Code reference:** `COOKIE_NOTICE_SUMMARY` in `src/lib/legal/copy.ts`.

---

The Provider Credentialing Portal uses only **strictly necessary** cookies
and similar technologies. We do not use analytics or advertising cookies,
and we do not allow third-party tracking on the Portal.

## Cookies we set

| Cookie | Purpose | Lifetime | Type |
|---|---|---|---|
| `next-auth.session-token` (staff) | Maintains your signed-in staff session | session, max 30 days | strictly necessary |
| `next-auth.csrf-token` (staff) | Cross-site request forgery protection during sign-in | session | strictly necessary |
| `__Host-ecred-provider` (provider) | Maintains your provider portal session after magic-link sign-in | 1 hour | strictly necessary |
| `__Host-ecred-csrf` (provider) | CSRF protection on provider mutations | session | strictly necessary |
| `ecred-app-progress` (provider) | Remembers the section of the application you're on | 24 hours | strictly necessary |

## Other technologies

- **Local storage** is used to persist a draft of your application
  between page loads so you do not lose your work if your browser
  refreshes. The draft is encrypted in transit when synced to our server
  and is deleted from local storage once you submit the application.
- **Audit beacons** record sign-in, sign-out, and other significant
  events to our server for compliance. These do not set persistent
  cookies.

## What we do **not** do

- We do not use Google Analytics, Adobe Analytics, Hotjar, Mixpanel, or
  similar.
- We do not use advertising or remarketing cookies.
- We do not allow social-media tracking pixels.
- We do not sell or share data collected via cookies.

## Your choices

Because all cookies are strictly necessary, the Portal does not display a
cookie consent banner. You can clear cookies in your browser at any time;
doing so will sign you out and may interrupt an in-progress application.

## Changes

If we ever introduce non-essential cookies, we will update this notice
and provide a clear opt-in choice. The version and effective date at the
top of this page will change when we do.

## Review checklist for Legal

- [ ] Confirm the cookie inventory matches the deployed app (verify after
      every release).
- [ ] Confirm that no third-party tracking is, in fact, in place.
- [ ] Decide whether to add a cookie consent banner if we ever ship a
      non-essential cookie (the design assumes "no banner needed" today).
