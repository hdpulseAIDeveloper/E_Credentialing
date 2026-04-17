-- Add EDUCATION_ACGME to BotType enum (P0 Gap #3 — Education PSV bots)
-- ACGME (Accreditation Council for Graduate Medical Education) is one of the
-- 11 NCQA CVO products. We expose it as a distinct bot type so its run history
-- is tracked separately from ECFMG and AMA Physician Masterfile.

ALTER TYPE "BotType" ADD VALUE IF NOT EXISTS 'EDUCATION_ACGME';
