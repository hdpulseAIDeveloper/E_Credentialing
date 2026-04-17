# ESSEN Credentialing Platform — User Training Plan

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Audience**: Training Lead, Credentialing Manager, IT  

---

## Training Objectives

By the end of the training program, all credentialing staff will be able to:

1. Log in via Azure AD SSO and navigate the platform confidently
2. Create and manage provider records through the full credentialing lifecycle
3. Use the document checklist, trigger verification bots, and interpret results
4. Manage tasks, communications, and follow-up reminders
5. Conduct committee sessions, generate agendas, and record approvals
6. Track enrollments with per-payer cadences and log follow-ups
7. Monitor expirables and respond to credential renewal alerts
8. Use the admin panel (Admins only) to manage users, roles, and system configuration

---

## Training Audience & Roles

| Role | # Staff | Priority Modules | Training Hours |
|------|---------|-----------------|----------------|
| **Credentialing Specialist** | 6–10 | Onboarding, Dashboard, Bots, Enrollments, Expirables | 9 hours |
| **Credentialing Manager** | 2–3 | All Specialist modules + Committee, Reporting, Admin oversight | 11 hours |
| **Committee Member / Medical Director** | 4–8 | Committee Dashboard (read-only), Approval voting | 2 hours |
| **System Admin** | 1–2 | Admin panel, User management, Provider type configuration | 4 hours |

---

## Training Schedule

### Pre-Training (1 week before sessions)

| Activity | Owner | Timeline |
|----------|-------|----------|
| Distribute user training guide (`docs/user-training.md`) to all staff | Training Lead | Day -7 |
| Create training environment accounts for all attendees | Developer | Day -5 |
| Send calendar invites with Zoom/Teams links | Training Lead | Day -5 |
| Distribute role-specific quick reference cards (1-pagers) | Training Lead | Day -3 |
| Verify training environment has demo data (50 providers, seed data) | Developer | Day -1 |

### Training Sessions

#### Session 1: Platform Overview & Navigation (All Staff)

**Duration**: 2 hours  
**Attendees**: All credentialing staff (Specialists, Managers, Committee Members, Admins)  
**Format**: Live demonstration + guided walkthrough  

| Time | Topic | Activity |
|------|-------|----------|
| 0:00–0:15 | Welcome & Goals | Introduction, why we're replacing PARCS, what to expect |
| 0:15–0:30 | Login & Authentication | Azure AD SSO demo, MFA, session management |
| 0:30–0:50 | Dashboard Tour | Main dashboard, sidebar navigation, role-based views |
| 0:50–1:10 | Provider Search & Filtering | Search by name/NPI, filter by status/type/specialist |
| 1:10–1:30 | Provider Detail Page | 8-tab overview, reading status badges, timeline |
| 1:30–1:50 | Hands-On Exercise | Each attendee: find 3 providers, review their records |
| 1:50–2:00 | Q&A | Open questions |

**Assessment**: Attendees must successfully log in, find a provider by NPI, and navigate all 8 tabs.

---

#### Session 2: Provider Onboarding & Document Management (Specialists + Managers)

**Duration**: 3 hours  
**Attendees**: Credentialing Specialists, Credentialing Managers  
**Format**: Live demonstration + hands-on practice  

| Time | Topic | Activity |
|------|-------|----------|
| 0:00–0:20 | Adding a New Provider | Create provider, required vs. optional fields, provider types |
| 0:20–0:40 | Status Progression | Walking a provider through INVITED → ONBOARDING → DOCS PENDING → VERIFICATION |
| 0:40–1:00 | Document Checklist | Upload documents, mark items, understand required/conditional/N/A |
| 1:00–1:15 | **Break** | — |
| 1:15–1:40 | Verification Bots | Navigate to bot panel, trigger bots, read results, handle flagged items |
| 1:40–2:00 | Task Management | Create tasks, assign to team, set priority/due date, complete tasks |
| 2:00–2:20 | Communications | Log phone calls, view communication history |
| 2:20–2:40 | Hands-On Exercise | Each attendee: create a provider, upload a document, trigger a bot, create a task |
| 2:40–3:00 | Q&A | Open questions |

**Assessment**: Attendees must create a provider, advance it through 2 status changes, upload a document, trigger a bot, and create a task.

---

#### Session 3: Committee Review & Approvals (Managers + Committee Members)

**Duration**: 2 hours  
**Attendees**: Credentialing Managers, Committee Members, Medical Directors  
**Format**: Live demonstration + simulated committee session  

| Time | Topic | Activity |
|------|-------|----------|
| 0:00–0:15 | Committee Queue Overview | How providers reach committee-ready, queue view |
| 0:15–0:35 | Creating a Committee Session | Set date/type, add providers, reorder agenda |
| 0:35–0:55 | Agenda & Summary Sheets | Auto-generated documents, distribution workflow |
| 0:55–1:15 | Simulated Committee Session | Walk through 3 providers: approve, deny (with reason), defer |
| 1:15–1:30 | Committee Member View | Read-only access, voting, adding comments |
| 1:30–1:50 | Hands-On Exercise | Each attendee: open session, review provider, record a decision |
| 1:50–2:00 | Q&A | Open questions |

**Assessment**: Managers must create a session, add providers, and record decisions. Committee members must view a session and submit a vote.

---

#### Session 4: Enrollments & Expirables (Specialists + Managers)

**Duration**: 2 hours  
**Attendees**: Credentialing Specialists, Credentialing Managers  
**Format**: Live demonstration + hands-on practice  

| Time | Topic | Activity |
|------|-------|----------|
| 0:00–0:20 | Enrollment Overview | Types (delegated, facility, direct), per-payer tracking |
| 0:20–0:40 | Creating & Managing Enrollments | Create record, update status workflow, log follow-ups |
| 0:40–1:00 | Follow-Up Cadence | How cadences work, setting next follow-up dates, overdue alerts |
| 1:00–1:10 | **Break** | — |
| 1:10–1:30 | Expirables Dashboard | Color-coded badges, sorting, filtering by urgency |
| 1:30–1:45 | Responding to Expirable Alerts | Review alert, contact provider, update expiration date |
| 1:45–1:55 | Hands-On Exercise | Each attendee: create an enrollment, log a follow-up, review expirables |
| 1:55–2:00 | Q&A | Open questions |

**Assessment**: Attendees must create an enrollment, update its status, log a follow-up, and identify the 3 most urgent expirables.

---

#### Session 5: System Administration (Admins Only)

**Duration**: 2 hours  
**Attendees**: System Admins (1–2 people)  
**Format**: Live demonstration + hands-on practice  

| Time | Topic | Activity |
|------|-------|----------|
| 0:00–0:20 | User Management | Create users, assign roles, deactivate/reactivate |
| 0:20–0:40 | Provider Type Configuration | Add provider types, set document requirements per type |
| 0:40–1:00 | System Settings | Notification thresholds, workflow configuration |
| 1:00–1:20 | Audit Trail | System-wide audit log, filtering, compliance review |
| 1:20–1:40 | Troubleshooting | Common issues, bot failure review, integration health |
| 1:40–2:00 | Q&A | Open questions |

**Assessment**: Admin must create a user, assign a role, configure a document requirement, and review audit logs.

---

## Training Materials

| Material | Format | Audience | Location |
|----------|--------|----------|----------|
| User Training Guide | Markdown (web) | All staff | `docs/user-training.md` |
| Implementation Plan | Markdown | Leadership | `docs/implementation-plan.md` |
| Quick Reference Cards | PDF (1 page per role) | All staff | `docs/training/` |
| Training Videos | Screen recordings (MP4) | All staff | `docs/training/videos/` |
| Pitch Deck | HTML presentation | Leadership | `docs/pitch-deck.html` |
| Hands-On Exercise Workbook | PDF | Training attendees | `docs/training/` |

### Quick Reference Card Contents

**Specialist Card (1 page)**:
- Login URL and SSO instructions
- How to add a provider (5 steps)
- How to trigger a bot (3 steps)
- How to create a task (4 steps)
- How to log an enrollment follow-up (3 steps)
- Expirable color code legend
- Support contact information

**Manager Card (1 page)**:
- Everything on Specialist card
- How to create a committee session (4 steps)
- How to approve/deny a provider (3 steps)
- How to generate and send an agenda (2 steps)

**Committee Member Card (1 page)**:
- Login URL and SSO instructions
- How to view your committee sessions
- How to review a provider summary sheet
- How to submit your vote
- Support contact information

**Admin Card (1 page)**:
- How to create/deactivate users
- How to configure provider types
- How to review audit logs
- How to check integration health

---

## Training Environment

| Property | Value |
|----------|-------|
| URL | `http://localhost:6015` (or dedicated training subdomain) |
| Database | Separate training database seeded with 50 demo providers |
| Credentials | Training accounts created with `@essenmed.com` emails |
| Reset | Training environment can be reset to seed state between sessions |

### Demo Data in Training Environment

- 50 providers across all status stages (INVITED through APPROVED)
- 6 provider types (MD, DO, PA, NP, LCSW, LMHC)
- Sample documents uploaded for 20 providers
- Sample bot run results (completed + flagged)
- Sample committee sessions (scheduled + completed)
- Sample enrollment records with follow-up histories
- Sample expirables at various alert thresholds

---

## Post-Training Support

### Week 1–2 After Training (Pilot Phase)

| Support Activity | Frequency | Owner |
|-----------------|-----------|-------|
| Office hours (drop-in Q&A) | Daily, 30 min | Training Lead |
| Dedicated Slack/Teams channel for questions | Always available | Developer + Training Lead |
| One-on-one coaching for struggling users | As needed | Training Lead |
| Bug/issue escalation path | As needed | Developer |

### Ongoing Support

| Support Activity | Frequency | Owner |
|-----------------|-----------|-------|
| Monthly "tips & tricks" email | Monthly | Training Lead |
| New feature training (when features are added) | As needed | Training Lead |
| Updated training guide | With each release | Developer |
| Annual refresher training | Annually | Training Lead |

---

## Training Evaluation

### Immediate Assessment (After Each Session)

Each attendee completes a hands-on assessment (described in session details above). Must pass to be certified for platform access.

### Post-Training Survey (1 Week After)

| Question | Scale |
|----------|-------|
| I feel confident using the platform for my daily work | 1–5 |
| The training covered everything I need to know | 1–5 |
| The hands-on exercises were helpful | 1–5 |
| The training materials (guide, reference card) are useful | 1–5 |
| What was the most valuable part of training? | Free text |
| What was unclear or needs more coverage? | Free text |

**Target**: Average score > 4.0 / 5.0 across all questions.

### 30-Day Competency Check

Training Lead observes each staff member performing their primary workflows in the live system during the pilot phase. Issues are addressed with targeted coaching.

| Competency | Specialist | Manager | Committee | Admin |
|-----------|-----------|---------|-----------|-------|
| Login & navigation | Required | Required | Required | Required |
| Provider management | Required | Required | — | — |
| Bot operations | Required | Required | — | — |
| Task management | Required | Required | — | — |
| Committee workflow | — | Required | Required | — |
| Enrollment tracking | Required | Required | — | — |
| Expirable monitoring | Required | Required | — | — |
| User management | — | — | — | Required |
