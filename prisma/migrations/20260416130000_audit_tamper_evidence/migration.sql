-- Tamper-evident audit log: append-only chain with monotonic sequence and HMAC linkage.
--
-- Columns added:
--   * ip_address, user_agent, request_id    — forensic context
--   * sequence (bigserial)                   — monotonic, server-generated
--   * previous_hash, hash                    — HMAC-SHA256 chain, computed by the app
--
-- Append-only enforcement at the DB layer:
--   * DELETE, TRUNCATE are blocked outright.
--   * UPDATE is blocked with one narrow exception: the application is allowed to
--     set the `hash` column exactly once, from NULL to a non-NULL value, on a
--     row whose chain-input columns have not changed. This permits the app to
--     compute and persist the HMAC after the insert, without permitting
--     general mutation. A revoke on UPDATE from the app role would also work,
--     but the trigger approach is self-contained and audit-evident.

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "hash" TEXT;

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "sequence" BIGSERIAL;

CREATE INDEX IF NOT EXISTS "audit_logs_sequence_idx" ON "audit_logs" ("sequence");

-- Block DELETE outright.
CREATE OR REPLACE FUNCTION audit_logs_block_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: DELETE not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- Block TRUNCATE outright.
CREATE OR REPLACE FUNCTION audit_logs_block_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: TRUNCATE not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- Guard UPDATE: only allow setting hash from NULL to non-NULL, with no other
-- column changes.
CREATE OR REPLACE FUNCTION audit_logs_guard_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.timestamp IS DISTINCT FROM NEW.timestamp
     OR OLD.actor_id IS DISTINCT FROM NEW.actor_id
     OR OLD.actor_role IS DISTINCT FROM NEW.actor_role
     OR OLD.action IS DISTINCT FROM NEW.action
     OR OLD.entity_type IS DISTINCT FROM NEW.entity_type
     OR OLD.entity_id IS DISTINCT FROM NEW.entity_id
     OR OLD.provider_id IS DISTINCT FROM NEW.provider_id
     OR OLD.before_state::text IS DISTINCT FROM NEW.before_state::text
     OR OLD.after_state::text IS DISTINCT FROM NEW.after_state::text
     OR OLD.metadata::text IS DISTINCT FROM NEW.metadata::text
     OR OLD.ip_address IS DISTINCT FROM NEW.ip_address
     OR OLD.user_agent IS DISTINCT FROM NEW.user_agent
     OR OLD.request_id IS DISTINCT FROM NEW.request_id
     OR OLD.sequence IS DISTINCT FROM NEW.sequence
     OR OLD.previous_hash IS DISTINCT FROM NEW.previous_hash THEN
    RAISE EXCEPTION 'audit_logs is append-only: only the hash column may be set, once, on a fresh row'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.hash IS NOT NULL THEN
    RAISE EXCEPTION 'audit_logs.hash is immutable once set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.hash IS NULL THEN
    RAISE EXCEPTION 'audit_logs.hash must be non-null on update'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs";

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_delete();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_truncate();

CREATE TRIGGER audit_logs_guard_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_guard_update();
