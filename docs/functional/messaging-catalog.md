# Messaging Catalog

**Audience:** Developers, designers, content reviewers, QA.

This catalog standardizes user-facing copy across the platform. Engineers
must reference catalog **keys** in code rather than hard-coding strings.
Translation, A/B copy testing, and content review all flow through this file.

---

## 1. Field validation messages

Used as inline form errors. Keys map 1:1 to zod custom error codes where
useful.

| Key | Message |
|---|---|
| `field.required` | "{Field} is required." |
| `field.tooShort` | "{Field} must be at least {min} characters." |
| `field.tooLong` | "{Field} must be no more than {max} characters." |
| `field.invalid` | "Enter a valid {field}." |
| `email.invalid` | "Enter a valid email address." |
| `phone.invalid` | "Enter a valid phone number." |
| `date.future.required` | "{Field} must be in the future." |
| `date.past.required` | "{Field} must be in the past." |
| `npi.format` | "NPI must be exactly 10 digits." |
| `npi.checksum` | "This NPI failed the standard checksum." |
| `npi.duplicate` | "An active provider already exists with this NPI." |
| `dea.format` | "DEA number must be 2 letters followed by 7 digits." |
| `caqh.format` | "CAQH ID is numeric." |
| `license.duplicate` | "This license is already on file." |
| `password.weak` | "Choose a longer or more complex password (≥ 12 chars, mixed case, number, symbol)." |
| `file.type` | "We accept PDF, PNG, and JPG files only." |
| `file.size` | "Each file must be under 25 MB." |
| `file.virus` | "This file failed our virus scan and cannot be uploaded." |
| `attestation.signature` | "Type your full legal name to attest." |

---

## 2. Toast confirmations (success)

| Key | Message |
|---|---|
| `provider.created` | "Provider created. Invite is queued for delivery." |
| `provider.updated` | "Changes saved." |
| `provider.invited` | "Invite sent." |
| `provider.reassigned` | "Provider reassigned to {name}." |
| `provider.statusChanged` | "Status updated to {status}." |
| `task.created` | "Task created and assigned to {name}." |
| `task.completed` | "Task marked complete." |
| `comm.logged` | "Communication logged." |
| `enrollment.statusChanged` | "Enrollment status updated." |
| `enrollment.followupLogged` | "Follow-up logged. Next due {date}." |
| `bot.queued` | "Bot queued. We'll update this card when it starts." |
| `bot.completed` | "Verification complete." |
| `expirable.renewed` | "{Credential} renewed. New expiry {date}." |
| `roster.generated` | "Roster generated for {payer}." |
| `roster.submitted` | "Roster submitted to {payer}." |
| `committee.sessionCreated` | "Committee session scheduled for {date}." |
| `committee.decision` | "Decision recorded for {provider}." |
| `user.created` | "User invited. They will sign in via Microsoft." |
| `user.deactivated` | "User deactivated." |
| `apiKey.created` | "API key created. Copy it now — it will not be shown again." |
| `apiKey.revoked` | "API key revoked." |

---

## 3. Toast errors (recoverable)

| Key | Message |
|---|---|
| `network.timeout` | "We couldn't reach the server. Please check your connection and try again." |
| `network.error` | "Something went wrong. Please try again." |
| `permission.denied` | "You don't have permission to do that." |
| `conflict.stale` | "This record changed in another tab. Please refresh and try again." |
| `bot.triggerFailed` | "We couldn't queue the bot. Try again or check the runbook." |
| `upload.failed` | "Upload failed. Please try again." |

---

## 4. Page banners

| Key | Severity | Message |
|---|---|---|
| `session.expiringSoon` | `warning` | "Your session will expire in {minutes} minutes. Save your work." |
| `session.expired` | `destructive` | "Your session expired. Please sign in again." |
| `provider.token.expired` | `warning` | "This invite link has expired. Contact your credentialing specialist for a new one." |
| `provider.token.revoked` | `warning` | "This invite link is no longer valid (a newer link was sent or your application was already submitted)." |
| `compliance.gap` | `caution` | "{Count} compliance items need your attention. Open the [Compliance dashboard](/compliance)." |
| `bot.outage` | `destructive` | "{Bot type} is currently offline. New runs will queue and retry." |
| `system.maintenance` | `info` | "Scheduled maintenance from {start} to {end}. Some features may be unavailable." |

---

## 5. Modal confirmations (destructive)

| Key | Title | Body | Confirm label |
|---|---|---|---|
| `user.deactivate.confirm` | "Deactivate this user?" | "They will lose access immediately. You can reactivate later." | "Deactivate" |
| `provider.deactivate.confirm` | "Deactivate this provider?" | "Their record stays for audit. They will not appear in active reports." | "Deactivate" |
| `apiKey.revoke.confirm` | "Revoke this key?" | "Any system using this key will lose access immediately. This action cannot be undone." | "Revoke" |
| `committee.delete.confirm` | "Delete this committee session?" | "Only sessions with no decisions recorded can be deleted." | "Delete" |
| `document.delete.confirm` | "Remove this document?" | "The file is preserved in audit storage but no longer linked to the provider." | "Remove" |

---

## 6. Email and SMS templates

Each template is rendered with React Email and stored in
`src/server/email/templates/`. Subject and body keys live in the catalog;
designers and compliance review them here before code lands.

### 6.1 Provider invite

- **Subject:** "Begin your Essen credentialing application"
- **Preview:** "Your secure link expires in 72 hours."
- **Body bullets:**
  - Greeting with provider first name.
  - One-paragraph context.
  - Primary CTA button: "Begin Application".
  - Sender signature with assigned Specialist's name.
  - Support contact line.
  - Plain-language privacy notice.

### 6.2 Provider expirable reminder (multi-cadence)

- **Subject 120/90/60/30/7-day:** "{Credential} expires {date}".
- **Body:** Plain language; links to upload renewal PDF; cadence-aware copy.
- **Final SMS (1-day):** "Reminder: your {credential} expires tomorrow. Upload your renewal at {link}."

### 6.3 Committee outcome

- **Approved:** "Welcome to Essen Medical credentialing." (Provider)
- **Denied:** "Update on your Essen credentialing application." (Provider)
- **Deferred:** "More information needed for your Essen credentialing application." (Provider)

### 6.4 Specialist notifications

- **Bot completed:** "{Bot type} for {provider} completed."
- **Bot requires manual:** "{Bot type} for {provider} needs manual completion. Open the runbook."
- **Sanction flagged:** "Sanctions match flagged for {provider}. Review in Compliance queue."
- **Committee decision:** "{Provider} was {decision} by the {date} committee."

---

## 7. Empty states

| Screen | Heading | Supporting | Primary action |
|---|---|---|---|
| Providers list | "No providers match these filters." | "Try removing a filter or add a new provider." | "+ New Provider" |
| Tasks | "Inbox zero — nice." | "Tasks assigned to you will appear here." | — |
| Bots | "No verifications yet." | "Run your first bot from the buttons above." | "Run a bot" |
| Enrollments | "No enrollments." | "Create an enrollment for this provider." | "+ New Enrollment" |
| Communications | "No communications logged." | "Log a call, email, or SMS to keep an audit trail." | "+ Log Communication" |
| Reports | "No saved reports yet." | "Build your first report to save filters and exports." | "Build a report" |

---

## 8. Notification bell items

| Event | Title | Body |
|---|---|---|
| Bot completed | "Bot completed" | "{Bot type} verified for {provider}." |
| Bot requires manual | "Manual action needed" | "{Bot type} for {provider} requires you." |
| Sanction flagged | "Sanctions match" | "{Provider} matched {source}." |
| Committee decision | "Committee outcome" | "{Provider} {decision}." |
| Task assigned | "New task" | "{Title} due {date}." |
| Expirable due | "Expirable due soon" | "{Credential} for {provider} expires {date}." |
| Recredentialing initiated | "Recredentialing initiated" | "{Provider}'s 36-month cycle started." |

---

## 9. Tone & voice

- Direct, neutral, plain English.
- Avoid "we" and "our". The platform speaks as the platform.
- Always tell the user what to do next when something fails.
- Never use emojis in transactional copy.
- Capitalize sentence case (not Title Case) in body text. Title Case allowed
  in headlines and button labels.
