# Quick Reference (Cheat Sheet)

A one-page reference for staff. Print it, pin it, share it.

## Sign in

- URL: https://credentialing.hdpulseai.com.
- Click **Sign in with Microsoft**. Use your ESSEN email + MFA.
- Locked out? Open an IT ticket; admin can re-grant your role.

## Top of every page

- **Search bar** — search providers by NPI, name, or email.
- **Notifications bell** — sanctions hits, NPDB alerts, task assignments.
- **Inbox** — email + SMS replies linked to providers.
- **Help** — opens this guide in a side panel.

## Common keyboard shortcuts

| Shortcut | Action |
|---|---|
| `g d` | Go to dashboard |
| `g p` | Go to providers |
| `g b` | Go to bots |
| `g c` | Go to committee |
| `g e` | Go to enrollments |
| `g r` | Go to reports |
| `?` | Open shortcut help |
| `/` | Focus search |
| `n` | Open notifications |

## Provider detail tabs

| Tab | Contents |
|---|---|
| Summary | Identity, status, key dates, owner |
| Application | Sections from intake (education, work history, etc.) |
| Documents | Uploaded files; AI-suggested categories you confirm |
| Verifications | Bot results, evidence PDFs, manual notes |
| Sanctions | Match history with reviewer notes |
| NPDB | Initial query + Continuous Query alerts |
| Privileges | Hospital privileges + OPPE / FPPE |
| Enrollments | Per payer-product status |
| Telehealth | State licenses + expirations |
| Recredentialing | Active and historical cycles |
| Audit | Recent audit-log entries |

## Status flags (provider)

| Status | Meaning |
|---|---|
| `INVITED` | Email sent; waiting on intake |
| `INTAKE` | Provider attested; data review in progress |
| `PSV_IN_PROGRESS` | One or more bots running |
| `READY_FOR_COMMITTEE` | All required PSVs complete |
| `APPROVED` / `DENIED` / `DEFERRED` | Committee outcome |
| `ENROLLED` | At least one active payer enrollment |
| `INACTIVE` | Off-boarded |

## Bot status colors

| Color | Meaning |
|---|---|
| Green | Verified |
| Amber | Manual review required |
| Red | Failed (after retries) |
| Gray | Not run / not applicable |

## Notifications

- Click a bell entry to jump to the provider/topic.
- Mark as read, pin, or assign to another teammate.
- Email + SMS preferences in **Profile → Notifications**.

## File upload rules

- Allowed types: PDF, JPG, JPEG, PNG, DOCX.
- Max size: 25 MB.
- AV scan happens before save; flagged files are rejected.

## Escalation

| Issue | Who |
|---|---|
| Bot keeps failing for everyone | IT / engineering |
| NPDB / FSMB billing alarm | Compliance + your manager |
| Suspected security incident | Stop and ping Sec immediately |
| Committee day technical glitch | Engineering on-call (in `#cred-platform`) |

## Useful links

- [User guide](README.md)
- [FAQ](faq.md)
- [Provider onboarding](provider-onboarding.md)
- [API](../api/README.md)
- [Compliance](../compliance/README.md)
