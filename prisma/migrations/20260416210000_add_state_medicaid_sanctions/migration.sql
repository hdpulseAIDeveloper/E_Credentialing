-- P0 Gap #5: Add STATE_MEDICAID source for state Medicaid exclusion checks
-- and AUTOMATIC_30DAY trigger label for the new NCQA 30-day cadence.
-- Also add the STATE_MEDICAID_EXCLUSION BotType so the sanctions-30day sweep
-- dedupes per-state runs cleanly instead of reusing OIG_SANCTIONS.

ALTER TYPE "SanctionsSource" ADD VALUE IF NOT EXISTS 'STATE_MEDICAID';
ALTER TYPE "SanctionsTriggeredBy" ADD VALUE IF NOT EXISTS 'AUTOMATIC_30DAY';
ALTER TYPE "BotType" ADD VALUE IF NOT EXISTS 'STATE_MEDICAID_EXCLUSION';
