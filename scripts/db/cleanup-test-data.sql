-- scripts/db/cleanup-test-data.sql
--
-- Local-dev / pre-demo cleanup. Wipes every transactional table while
-- PRESERVING the foundational reference tables that are seeded by
-- migrations or by `npm run db:seed`:
--
--   PRESERVED (never touched):
--     users
--     workflows
--     provider_types
--     document_requirements
--     app_settings
--     ai_model_cards
--     training_courses
--     compliance_controls
--     ncqa_criteria
--     privilege_categories
--     privilege_items
--     facility_coverage_minimums
--     directory_organizations  (ref orgs are pre-seeded)
--
-- IMPORTANT
-- - audit_logs is also wiped (HMAC chain restarts at sequence=1 on next
--   write). Local dev only — never run on production.
-- - We use DELETE (not TRUNCATE…CASCADE). DELETE honors ON DELETE
--   SET NULL on FKs back to the preserved tables, so the preserved
--   rows stay intact (they just get their nullable FK columns nulled
--   out). TRUNCATE…CASCADE would have wiped them too — that was the
--   bug in the original cleanup script.
-- - Order matters: children first, then parents, then audit_logs last.
-- - audit_logs immutability triggers are temporarily disabled inside
--   the txn and re-enabled before COMMIT.
--
-- Run:
--   docker exec -i localai-postgres-1 psql -U postgres -d e_credentialing_db < scripts/db/cleanup-test-data.sql

\set ON_ERROR_STOP on

BEGIN;

-- 1. Disable audit-log immutability triggers for the duration of this txn.
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_delete;
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_truncate;
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_guard_update;

-- 2. DELETE in dependency order: children first, parents last. We use
--    DELETE (not TRUNCATE) so ON DELETE SET NULL FKs back to preserved
--    tables (users, workflows, ai_model_cards, compliance_controls, …)
--    keep the parent rows intact and just null the column.

-- 2a. Children of bot_runs (verifications/sanctions/npdb/medicaid/exception verdicts)
DELETE FROM bot_exception_verdicts;
DELETE FROM verification_records;
DELETE FROM sanctions_checks;
DELETE FROM npdb_records;

-- 2b. Children of tasks
DELETE FROM task_comments;

-- 2c. AI runtime
DELETE FROM ai_messages;
DELETE FROM ai_decision_logs;
DELETE FROM ai_conversations;

-- 2d. Compliance runtime (controls + criteria refs preserved)
DELETE FROM compliance_evidence;
DELETE FROM compliance_gaps;
DELETE FROM compliance_audit_periods;
DELETE FROM ncqa_criterion_assessments;
DELETE FROM ncqa_compliance_snapshots;

-- 2e. Roster
DELETE FROM roster_submissions;
DELETE FROM payer_rosters;

-- 2f. Committee
DELETE FROM committee_providers;
DELETE FROM committee_sessions;

-- 2g. Enrollment follow-ups → enrollments
DELETE FROM enrollment_follow_ups;
DELETE FROM enrollments;

-- 2h. Peer review
DELETE FROM peer_review_minutes;
DELETE FROM peer_review_meetings;

-- 2i. FSMB PDC
DELETE FROM fsmb_pdc_events;
DELETE FROM fsmb_pdc_subscriptions;

-- 2j. Provider-rooted aggregates (must come before bot_runs / providers)
DELETE FROM checklist_items;
DELETE FROM expirables;
DELETE FROM hospital_privileges;
DELETE FROM cme_credits;
DELETE FROM staff_training_records;
DELETE FROM training_assignments;
DELETE FROM supervision_attestations;
DELETE FROM telehealth_platform_certs;
DELETE FROM practice_evaluations;
DELETE FROM monitoring_alerts;
DELETE FROM malpractice_verifications;
DELETE FROM medicaid_enrollments;
DELETE FROM recredentialing_cycles;
DELETE FROM professional_references;
DELETE FROM work_history_verifications;
DELETE FROM directory_practitioner_roles;
DELETE FROM directory_endpoints;
DELETE FROM directory_locations;

-- 2k. Documents (referenced by checklist_items.document_id, expirables,
--     hospital_privileges, cme_credits, verification_records — all already
--     wiped above so this is safe).
DELETE FROM documents;

-- 2l. Bot runs (after their children verification_records etc.)
DELETE FROM bot_runs;

-- 2m. Communications + tasks (after task_comments)
DELETE FROM communications;
DELETE FROM tasks;

-- 2n. Licenses + provider_profiles before providers
DELETE FROM licenses;
DELETE FROM provider_profiles;

-- 2o. API + saved reports (FK back to users, but ON DELETE preserves them)
DELETE FROM api_keys;
DELETE FROM saved_reports;

-- 2p. Providers themselves
DELETE FROM providers;

-- 2q. Audit log last (after every write that might generate one)
DELETE FROM audit_logs;

-- 3. Re-enable audit-log triggers before commit.
ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_delete;
ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_truncate;
ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_guard_update;

COMMIT;

-- 4. Verify. Transactional counts must be 0; preserved counts must match
--    what `npm run db:seed` produces.
SELECT 'providers'                AS t, COUNT(*) FROM providers           UNION ALL
SELECT 'bot_runs'                    , COUNT(*) FROM bot_runs            UNION ALL
SELECT 'tasks'                       , COUNT(*) FROM tasks               UNION ALL
SELECT 'communications'              , COUNT(*) FROM communications      UNION ALL
SELECT 'enrollments'                 , COUNT(*) FROM enrollments         UNION ALL
SELECT 'expirables'                  , COUNT(*) FROM expirables          UNION ALL
SELECT 'committee_sessions'          , COUNT(*) FROM committee_sessions  UNION ALL
SELECT 'audit_logs'                  , COUNT(*) FROM audit_logs          UNION ALL
SELECT 'documents'                   , COUNT(*) FROM documents           UNION ALL
SELECT 'recredentialing_cycles'      , COUNT(*) FROM recredentialing_cycles UNION ALL
SELECT '— preserved —'               , 0                                 UNION ALL
SELECT 'users (pres)'                , COUNT(*) FROM users               UNION ALL
SELECT 'workflows (pres)'            , COUNT(*) FROM workflows           UNION ALL
SELECT 'provider_types (pres)'       , COUNT(*) FROM provider_types      UNION ALL
SELECT 'document_reqs (pres)'        , COUNT(*) FROM document_requirements UNION ALL
SELECT 'app_settings (pres)'         , COUNT(*) FROM app_settings        UNION ALL
SELECT 'training_courses (pres)'     , COUNT(*) FROM training_courses    UNION ALL
SELECT 'compliance_controls (pres)'  , COUNT(*) FROM compliance_controls UNION ALL
SELECT 'ncqa_criteria (pres)'        , COUNT(*) FROM ncqa_criteria       UNION ALL
SELECT 'ai_model_cards (pres)'       , COUNT(*) FROM ai_model_cards      UNION ALL
SELECT 'privilege_categories (pres)' , COUNT(*) FROM privilege_categories UNION ALL
SELECT 'privilege_items (pres)'      , COUNT(*) FROM privilege_items     UNION ALL
SELECT 'facility_coverage (pres)'    , COUNT(*) FROM facility_coverage_minimums UNION ALL
SELECT 'directory_orgs (pres)'       , COUNT(*) FROM directory_organizations;
