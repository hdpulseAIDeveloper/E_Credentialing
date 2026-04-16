-- Performance indexes migration
-- Adds indexes on hot query paths identified via router audits.
-- Safe to run on large tables in Postgres because CREATE INDEX IF NOT EXISTS is idempotent,
-- but we deliberately use plain CREATE INDEX (no CONCURRENTLY) so Prisma manages this
-- inside a transaction. For very large production tables, a DBA may prefer
-- CREATE INDEX CONCURRENTLY outside Prisma's transaction wrapper.

-- ─── providers ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "providers_status_idx"                  ON "providers"("status");
CREATE INDEX IF NOT EXISTS "providers_provider_type_id_idx"        ON "providers"("provider_type_id");
CREATE INDEX IF NOT EXISTS "providers_assigned_specialist_id_idx"  ON "providers"("assigned_specialist_id");
CREATE INDEX IF NOT EXISTS "providers_legal_last_name_idx"         ON "providers"("legal_last_name");
CREATE INDEX IF NOT EXISTS "providers_invite_token_idx"            ON "providers"("invite_token");
CREATE INDEX IF NOT EXISTS "providers_caqh_id_idx"                 ON "providers"("caqh_id");
CREATE INDEX IF NOT EXISTS "providers_icims_id_idx"                ON "providers"("icims_id");
CREATE INDEX IF NOT EXISTS "providers_approved_at_idx"             ON "providers"("approved_at");
CREATE INDEX IF NOT EXISTS "providers_created_at_idx"              ON "providers"("created_at");

-- ─── users ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "users_role_idx"        ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_is_active_idx"   ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "users_provider_id_idx" ON "users"("provider_id");

-- ─── documents ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "documents_is_deleted_idx"                      ON "documents"("is_deleted");
CREATE INDEX IF NOT EXISTS "documents_provider_id_document_type_idx"       ON "documents"("provider_id", "document_type");
CREATE INDEX IF NOT EXISTS "documents_expiration_date_idx"                 ON "documents"("expiration_date");

-- ─── bot_runs ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bot_runs_bot_type_idx"                         ON "bot_runs"("bot_type");
CREATE INDEX IF NOT EXISTS "bot_runs_provider_id_bot_type_created_at_idx"  ON "bot_runs"("provider_id", "bot_type", "created_at");
CREATE INDEX IF NOT EXISTS "bot_runs_queued_at_idx"                        ON "bot_runs"("queued_at");

-- ─── tasks ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx"                   ON "tasks"("due_date");
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_status_idx"         ON "tasks"("assigned_to", "status");

-- ─── enrollments ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "enrollments_enrollment_type_idx"       ON "enrollments"("enrollment_type");
CREATE INDEX IF NOT EXISTS "enrollments_assigned_to_idx"           ON "enrollments"("assigned_to");
CREATE INDEX IF NOT EXISTS "enrollments_follow_up_due_date_idx"    ON "enrollments"("follow_up_due_date");

-- ─── expirables ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "expirables_expirable_type_idx"         ON "expirables"("expirable_type");
CREATE INDEX IF NOT EXISTS "expirables_next_check_date_idx"        ON "expirables"("next_check_date");
CREATE INDEX IF NOT EXISTS "expirables_status_expiration_date_idx" ON "expirables"("status", "expiration_date");

-- ─── sanctions_checks ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "sanctions_checks_source_run_date_idx"              ON "sanctions_checks"("source", "run_date");
CREATE INDEX IF NOT EXISTS "sanctions_checks_result_idx"                       ON "sanctions_checks"("result");
CREATE INDEX IF NOT EXISTS "sanctions_checks_provider_id_source_run_date_idx"  ON "sanctions_checks"("provider_id", "source", "run_date");

-- ─── npdb_records ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "npdb_records_query_type_idx" ON "npdb_records"("query_type");
CREATE INDEX IF NOT EXISTS "npdb_records_result_idx"     ON "npdb_records"("result");

-- ─── hospital_privileges ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "hospital_privileges_status_idx"          ON "hospital_privileges"("status");
CREATE INDEX IF NOT EXISTS "hospital_privileges_expiration_date_idx" ON "hospital_privileges"("expiration_date");

-- ─── medicaid_enrollments ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "medicaid_enrollments_affiliation_status_idx"    ON "medicaid_enrollments"("affiliation_status");
CREATE INDEX IF NOT EXISTS "medicaid_enrollments_revalidation_due_date_idx" ON "medicaid_enrollments"("revalidation_due_date");

-- ─── audit_logs ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"                    ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx"     ON "audit_logs"("entity_type", "entity_id");
