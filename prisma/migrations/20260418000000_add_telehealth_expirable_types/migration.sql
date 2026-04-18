-- Wave 3.4 — Telehealth & IMLC Expirables integration.
--
-- Add two new ExpirableType enum values so the nightly
-- TelehealthExpirablesSync service (src/server/services/telehealth-expirables.ts)
-- can mirror per-platform telehealth certifications and the IMLC Letter of
-- Qualification onto the central /expirables board. This gives staff a
-- single source of truth for everything that ages.
--
-- ALTER TYPE ... ADD VALUE is forward-only (Postgres cannot drop enum
-- values cleanly); the migration is intentionally narrow.
ALTER TYPE "ExpirableType" ADD VALUE IF NOT EXISTS 'TELEHEALTH_PLATFORM_CERT';
ALTER TYPE "ExpirableType" ADD VALUE IF NOT EXISTS 'IMLC_LOQ';
