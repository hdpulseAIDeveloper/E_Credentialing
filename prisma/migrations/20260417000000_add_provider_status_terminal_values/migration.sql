-- Gap Analysis 2026 follow-up: add TERMINATED + WITHDRAWN to ProviderStatus.
--
-- The P1 / P3 worker jobs (caqh-reattestation, telehealth-compliance,
-- supervision-reminder) reference these enum values in their `where.status`
-- clauses to exclude providers who have left the organization or withdrew
-- their application. Without these enum members the build:worker step fails
-- TypeScript strict-mode compilation, which has been blocking production
-- deploys since commit c835aa2.
--
-- ALTER TYPE ... ADD VALUE is forward-only (Postgres cannot drop enum
-- values cleanly); the migration is intentionally narrow.
ALTER TYPE "ProviderStatus" ADD VALUE IF NOT EXISTS 'TERMINATED';
ALTER TYPE "ProviderStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
