# Troubleshooting

A quick reference for the most common issues new users hit. If your
issue isn't listed here, contact the platform owner via the channel
in [README.md](./README.md).

## Sign-in

### "Microsoft sign-in failed"

- Confirm you're signed into the correct Microsoft tenant
  (`hdpulseai.com` or your organization's tenant). Sign out of
  personal Microsoft accounts in the same browser profile first.
- If your account was just created, the directory replication can
  take up to 15 minutes. Try again after that window.
- If the failure persists, your account may need to be added to the
  `ecred-staff` group. See
  [provider-onboarding.md](./provider-onboarding.md) for staff
  onboarding.

### "Multi-factor challenge isn't arriving"

- Confirm your authenticator app is in sync with the server clock.
  Re-enroll the app from `https://aka.ms/mfasetup` if it's been
  more than 90 days since enrollment.
- Switch to phone-call or hardware-key MFA temporarily if the app
  channel is broken.

## Provider invite links

### "This invite link is no longer valid"

- An invite link is single-use and expires. Ask the credentialing
  team to send a fresh one.
- If you received the link more than 14 days ago, it has expired.
  Fresh links are valid for 14 days.

## Documents

### "Upload failed"

- Documents must be PDF, JPG, or PNG and under 25 MB.
- Filenames must contain only letters, digits, hyphens, underscores,
  and a single dot before the extension.
- If the upload spinner hangs, refresh the page and try again -- the
  upload session may have timed out.

### "Document is processing" never finishes

- The OCR pipeline can take up to 60 seconds for large PDFs. If it
  hasn't completed after 5 minutes, contact the platform owner with
  the document id.

## Search and filters

### "I can't find a provider I know is in the system"

- The search box matches name, NPI, and DEA. Try the NPI if the
  name search returns nothing -- the provider may be filed under a
  legal name different from their preferred name.
- The roster filter defaults to "Active". Switch to "All" to see
  inactive or terminated providers.

## Reporting

### "Export to CSV produced an empty file"

- Confirm your filters return any rows in the table view first. The
  CSV export honors the active filters.
- Some columns are PHI-redacted by role. If you can see only six
  columns in the CSV, your role does not have access to the
  remaining columns.

## When to escalate

Page the platform owner via the on-call rotation if:

- The application is fully unreachable for more than 5 minutes.
- Sign-in is failing for the entire team (not just one person).
- A document or provider record looks corrupted (missing fields
  that should be present, dates that look wrong).
- You see PHI in a place you would not expect it. This is a
  potential HIPAA incident -- escalate immediately and do not share
  screenshots.

## Cross-reference

- Sign-in flow: [getting-started.md](./getting-started.md)
- Compliance and PHI handling: [security.md](./security.md)
- Bot status interpretation: [bots.md](./bots.md)
