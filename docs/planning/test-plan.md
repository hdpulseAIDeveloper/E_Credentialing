# ESSEN Credentialing Platform — Comprehensive Test Plan

**Environment**: `http://localhost:6015`
**Admin credentials**: `admin@hdpulseai.com` / `Users1!@#$%^`
**Last updated**: 2026-04-15

---

## Test Execution Summary

| Module | Status | Notes |
|--------|--------|-------|
| 1. Authentication | ✅ PASS | Landing, sign-in, register all verified |
| 2. Onboarding Dashboard | ✅ PASS | Stats, pipeline table, task list render with seed data |
| 3. Providers List | ✅ PASS | All statuses, search, filter work |
| 4. Provider Detail | ✅ PASS | All 8 tabs render correctly |
| 5. Bot Control Panel | ✅ PASS (fixed) | `handleTriggerBot` fixed to use tRPC mutation |
| 6. Committee Dashboard | ✅ PASS | Queue, sessions, Create Session form all present |
| 7. Committee Session Detail | ✅ PASS | Provider entries and decisions render |
| 8. Enrollments | ✅ PASS | List with stats, detail page, clickable payer links |
| 9. Expirables | ✅ PASS | Color-coded days-remaining, all providers linked |
| 10. Admin Panel | ✅ PASS | Stats, user list, provider types all render |

---

## Module 1 — Authentication

### TC-1.1 Landing Page
- Navigate to `http://localhost:6015/`
- **Expected**: Gradient landing page with ESSEN logo, "Sign In" and "Register" buttons in nav, hero section with CTA buttons, 3 feature cards, footer
- **Expected (authenticated)**: Redirect to `/dashboard`
- **Status**: ✅ PASS — Returns 200, auto-redirects authenticated users

### TC-1.2 Sign-In Form
- Navigate to `/auth/signin`
- **Expected**: Email + password form, show/hide password toggle, "Sign in with Microsoft (coming soon)" disabled button, links to Register
- Sign in with `admin@hdpulseai.com` / `Users1!@#$%^`
- **Expected**: Redirects to `/dashboard`
- Sign in with wrong password
- **Expected**: "Invalid email or password" error message in red banner
- Sign in with empty fields
- **Expected**: Field-level validation messages appear
- **Status**: ✅ PASS — Form validation, signIn("credentials"), redirect on success

### TC-1.3 Registration Form
- Navigate to `/auth/register`
- **Expected**: First name, last name, email, phone (optional), password, confirm password fields
- Enter a valid password while typing
- **Expected**: Live password criteria checklist appears below password field (green checkmarks as criteria are met)
- Submit with mismatched passwords
- **Expected**: "Passwords do not match" error on confirmPassword
- Register with an existing email
- **Expected**: Email field shows "already registered" error (409 mapped to field)
- Register with a new email and valid password
- **Expected**: Account created, auto signed-in, redirect to `/dashboard`
- **Status**: ✅ PASS — POSTs to `/api/auth/register`, auto-signs-in on success

### TC-1.4 Protected Route Redirect
- Navigate to `/dashboard` while signed out
- **Expected**: 307 redirect to `/auth/signin?callbackUrl=...`
- **Status**: ✅ PASS — Middleware enforces auth on all staff routes

### TC-1.5 Sign-Out
- While signed in, click "Sign out" in the sidebar
- **Expected**: Session cleared, redirect to `/auth/signin`
- **Status**: ✅ PASS — `signOut({ callbackUrl: "/auth/signin" })` via next-auth/react

---

## Module 2 — Onboarding Dashboard (`/dashboard`)

### TC-2.1 Stats Cards
- **Expected**: 3 stat cards: "In Progress" (blue), "Committee Ready" (yellow), "Approved Total" (green)
- **Expected**: Counts reflect seed data (providers in ONBOARDING_IN_PROGRESS, DOCUMENTS_PENDING, VERIFICATION_IN_PROGRESS statuses counted for "In Progress")
- **Status**: ✅ PASS — Prisma counts render correctly

### TC-2.2 Pipeline Table
- **Expected**: Table showing all active providers (not APPROVED/DENIED/INACTIVE), with columns: Provider, Type, Status, Docs, Specialist, Updated, Actions
- **Expected**: Search box filters providers by name or NPI
- **Expected**: Status dropdown filters by selected status
- **Expected**: Provider name links to `/providers/{id}`
- **Expected**: "Bots" link goes to `/providers/{id}/bots`
- **Status**: ✅ PASS — Client-side filter works with seed data (10+ providers shown)

### TC-2.3 My Tasks Panel
- **Expected**: Right-side panel showing tasks assigned to the logged-in user, with priority badge and due date
- **Expected**: Empty state "No open tasks" if no tasks assigned to this user
- **Status**: ✅ PASS — Tasks load from DB, filtered by `assignedToId: session.user.id`

---

## Module 3 — Providers List (`/providers`)

### TC-3.1 Full Provider List
- **Expected**: Table with all providers across all statuses, columns: Provider, Type, NPI, Status, Specialist, Actions
- **Expected**: Provider count shown in subtitle ("14 results" with seed data)
- **Status**: ✅ PASS — No status filter applied, all 14 seed providers shown

### TC-3.2 Search by Name
- Type a partial name in the search box and click Filter
- **Expected**: Table filtered to matching providers
- **Status**: ✅ PASS — OR query on legalFirstName, legalLastName, npi

### TC-3.3 Status Filter
- Select "Approved" from the status dropdown and click Filter
- **Expected**: Only APPROVED providers shown
- Click "Clear" link
- **Expected**: Full list restored
- **Status**: ✅ PASS — GET request with `?status=APPROVED`

### TC-3.4 Provider Navigation
- Click a provider name or "View" link
- **Expected**: Navigates to `/providers/{id}`
- Click "Bots" link
- **Expected**: Navigates to `/providers/{id}/bots`
- **Status**: ✅ PASS

---

## Module 4 — Provider Detail (`/providers/{id}`)

### TC-4.1 Header
- **Expected**: Provider's full legal name (with middle name if present), provider type, status badge, NPI
- **Expected**: Right side shows assigned specialist name and application submitted date
- **Status**: ✅ PASS

### TC-4.2 Tab: Overview
- **Expected**: Two cards: "Provider Information" (NPI, DEA, CAQH ID, iCIMS ID, Type) and "Timeline" (Invited, App Started, App Submitted, Committee Ready, Approved dates)
- **Expected**: Missing dates show "—"
- **Status**: ✅ PASS

### TC-4.3 Tab: Documents & Checklist
- Click "Documents & Checklist" tab
- **Expected**: ChecklistPanel renders with progress bar (X/Y received), list of checklist items with colored status badges (green=RECEIVED, gray=PENDING, red=NEEDS_ATTENTION)
- **Status**: ✅ PASS — All 3 ChecklistStatus values covered

### TC-4.4 Tab: Verifications
- Click "Verifications" tab
- **Expected**: List of verification records with credential type, verified date, expiration date, FLAGGED badge if flagged, status badge (VERIFIED=green, others=red)
- **Status**: ✅ PASS

### TC-4.5 Tab: Tasks
- Click "Tasks" tab (count shown in label)
- **Expected**: List of open tasks with title, priority badge (HIGH=red, MEDIUM=yellow, LOW=gray), assigned user, due date
- Empty state: "No open tasks"
- **Status**: ✅ PASS

### TC-4.6 Tab: Communications
- Click "Communications" tab
- **Expected**: List of communication records with type, date, body preview (line-clamp-2)
- Empty state: "No communications yet"
- **Status**: ✅ PASS

### TC-4.7 Tab: Enrollments
- Click "Enrollments" tab (count shown in label)
- **Expected**: List of enrollments with payer name (links to `/enrollments/{id}`), type, method, follow-up date
- **Status**: ✅ PASS

### TC-4.8 Tab: Expirables
- Click "Expirables" tab (count shown in label)
- **Expected**: List showing credential type, expiration date, color-coded days badge (red=expired/<14d, orange=30d, yellow=60d, green=60d+)
- **Status**: ✅ PASS

### TC-4.9 Tab: Audit Trail
- Click "Audit Trail" tab
- **Expected**: Placeholder message "Audit trail is available via the full audit log page."
- **Status**: ✅ PASS (placeholder — full audit trail is future work)

---

## Module 5 — Bot Control Panel (`/providers/{id}/bots`)

### TC-5.1 Page Load
- Navigate to `/providers/{id}/bots`
- **Expected**: "← Back to {Name}" link, "Bot Control Panel" heading, list of bot rows for this provider's type
- **Expected**: MD gets 7 bots, PA gets 4 bots, etc.
- **Status**: ✅ PASS

### TC-5.2 Bot Row Display
- **Expected**: Each row shows bot name, "Never run" or last run timestamp + duration, status badge (QUEUED/RUNNING/COMPLETED/FAILED/RETRYING/REQUIRES_MANUAL), and Run/Re-run button
- **Expected**: QUEUED and RUNNING states disable the button
- **Status**: ✅ PASS

### TC-5.3 Trigger Bot
- Click "Run" on a bot row (requires Redis + worker to be running)
- **Expected**: Button shows "Running…" while mutation is in flight, then optimistically updates to show the new QUEUED run
- **Status**: ✅ FIXED — Was using raw fetch with incorrect body format; now uses `api.bot.triggerBot.useMutation()`
- **Note**: Bot will queue but won't execute real verification without external credentials configured

---

## Module 6 — Committee Dashboard (`/committee`)

### TC-6.1 Page Load
- **Expected**: "Active Sessions" list and "Ready for Committee" provider queue
- **Status**: ✅ PASS

### TC-6.2 Active Sessions
- **Expected**: Clickable session rows showing date, provider count, location, SCHEDULED/IN_PROGRESS status badge
- Empty state: "No active sessions"
- **Status**: ✅ PASS — 3 seeded sessions shown

### TC-6.3 Committee Queue
- **Expected**: Providers with status=COMMITTEE_READY listed with name (links to provider detail), type, time-ago since committee-ready
- **Status**: ✅ PASS

### TC-6.4 Create Session Button
- Click "Create Session" button
- **Expected**: Navigates to `/committee/sessions/new`
- **Status**: ✅ PASS — Was previously 404; page created in previous session

### TC-6.5 Create Session Form
- Fill in session date (future date), optional time and location
- Click "Create Session"
- **Expected**: Session created via `api.committee.createSession.useMutation()`, redirect to `/committee/sessions/{id}`
- **Note**: Requires MANAGER or ADMIN role
- Submit without a date
- **Expected**: "Session date is required." error message
- **Status**: ✅ PASS

---

## Module 7 — Committee Session Detail (`/committee/sessions/{id}`)

### TC-7.1 Page Load
- Navigate to a seeded session
- **Expected**: "Committee Session — {date}" heading, location if set, status badge, "Generate Agenda" button (when SCHEDULED)
- **Expected**: List of providers assigned to session
- **Status**: ✅ PASS

### TC-7.2 Providers Under Review
- **Expected**: Cards for each provider showing name, type, decision badge (Pending/APPROVED/DENIED/DEFERRED/CONDITIONAL), committee notes
- **Status**: ✅ PASS

---

## Module 8 — Enrollments (`/enrollments`)

### TC-8.1 Stats Bar
- **Expected**: 5 stat cards: Draft, Submitted, Pending Payer, Enrolled, Overdue Follow-Up (in red)
- **Status**: ✅ PASS

### TC-8.2 Enrollments Table
- **Expected**: Provider name (links to provider detail), payer name (links to enrollment detail), type, status badge, follow-up due date (red + "OVERDUE" if past due), assigned specialist
- **Expected**: Overdue rows have `bg-red-50` background
- **Status**: ✅ PASS — Payer name link to enrollment detail was added in previous session

### TC-8.3 Enrollment Detail (`/enrollments/{id}`)
- Click a payer name
- **Expected**: Detail page with "Enrollment Details" card (payer, type, method, status, submitted date, effective date, confirmation number) and optional "Payer Response Notes" card
- **Expected**: Follow-up history if any follow-ups logged
- **Status**: ✅ PASS — Loads via `api.enrollment.getById`

---

## Module 9 — Expirables (`/expirables`)

### TC-9.1 Full Table
- **Expected**: Table with Provider (links to provider detail), Credential Type, Status badge, Expires date, Days Left badge
- **Expected**: Color coding: <0 days=EXPIRED (red), ≤7d=red, ≤30d=orange, ≤60d=yellow, >60d=blue
- **Expected**: Only non-RENEWED expirables shown
- **Status**: ✅ PASS — 17 seeded expirables with mixed colors

---

## Module 10 — Admin Panel (`/admin`)

### TC-10.1 Admin Stats
- **Expected**: 4 stat cards: Total Users, Total Providers, Provider Types, Failed Bot Runs
- **Note**: Only accessible to ADMIN and MANAGER roles; others redirected to `/dashboard`
- **Status**: ✅ PASS

### TC-10.2 Admin Navigation Cards
- **Expected**: 3 cards: "User Management" → `/admin/users`, "Provider Types" → `/admin/provider-types`, "Queue Dashboard" → `/bull-board`
- **Status**: ✅ PASS

### TC-10.3 User Management (`/admin/users`)
- **Expected**: Table of all staff users with name, email, role badge, Active/Inactive status badge, last login date
- **Expected**: "Invite User" button (non-functional UI placeholder)
- **Status**: ✅ PASS — Lists all 6 seed users (admin + 5 staff)

### TC-10.4 Provider Types (`/admin/provider-types`)
- **Expected**: Table with name, code (abbreviation), required docs count, active/inactive badge
- **Expected**: 6 provider types from seed: MD, DO, PA, NP, LCSW, LMHC
- **Status**: ✅ PASS

---

## Bugs Fixed During Testing

| ID | Issue | Resolution |
|----|-------|-----------|
| BUG-01 | `BotStatusPanel.handleTriggerBot` used raw `fetch` with incorrect tRPC body format | Fixed: now uses `api.bot.triggerBot.useMutation()` |
| BUG-02 | Socket.io connected to Next.js app URL (port 6015) instead of worker URL (port 6025) | Fixed: Added `NEXT_PUBLIC_WORKER_URL` env var; socket.io now only connects if var is set |
| BUG-03 | Missing `NEXT_PUBLIC_WORKER_URL` in `.env.local` and `docker-compose.dev.yml` | Fixed: Added to both files |

---

## Known Limitations (by design / future work)

| Area | Limitation |
|------|-----------|
| Bot triggering | Bots queue but won't run without external credentials (Azure Key Vault, DEA TOTP) |
| Real-time updates | Socket.io requires worker on port 6025; works when `NEXT_PUBLIC_WORKER_URL` is set |
| Provider application form | Sections 2–8 show placeholder text; only sections 0–1 (Personal Info, Contact) are fully built |
| Audit trail tab | Shows placeholder — full audit log page is future work |
| Azure SSO | "Sign in with Microsoft" button is disabled; Azure AD credentials are placeholders in dev |
| Document upload | Upload UI exists but Azure Blob Storage account URL is not configured in dev |
| Email notifications | SendGrid not configured in dev; emails will fail silently |
| Invite User / Add Provider Type | UI buttons present but non-functional (mutations exist in tRPC, UI forms not built) |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hdpulseai.com | Users1!@#$%^ |
| Specialist | sarah.johnson@essenmed.com | (no password — SSO user only) |

**Note**: Staff users seeded via SSO mock (no passwordHash). Only `admin@hdpulseai.com` has email/password auth. All other staff users are SSO-only and require Azure AD to be configured.
