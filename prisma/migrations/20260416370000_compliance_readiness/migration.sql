-- P3 Gap #23 — HITRUST r2 / SOC 2 Type II readiness tracker

CREATE TYPE "ComplianceFramework" AS ENUM ('HITRUST_R2', 'SOC2_TYPE_II');
CREATE TYPE "ComplianceControlStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','IMPLEMENTED','PARTIAL','NOT_APPLICABLE');
CREATE TYPE "ComplianceControlMaturity" AS ENUM ('POLICY','PROCESS','IMPLEMENTED','MEASURED','MANAGED');
CREATE TYPE "ComplianceGapSeverity" AS ENUM ('LOW','MODERATE','HIGH','CRITICAL');
CREATE TYPE "ComplianceGapStatus" AS ENUM ('OPEN','IN_REMEDIATION','PENDING_VALIDATION','CLOSED','RISK_ACCEPTED');
CREATE TYPE "ComplianceAuditPeriodStatus" AS ENUM ('PLANNING','FIELDWORK','REPORTING','COMPLETED','CANCELLED');
CREATE TYPE "ComplianceEvidenceType" AS ENUM ('POLICY','PROCEDURE','SCREENSHOT','LOG_EXPORT','CONFIG_EXPORT','ATTESTATION','TICKET','TRAINING_CERT','REPORT','OTHER');

CREATE TABLE "compliance_controls" (
  "id"               TEXT                          PRIMARY KEY,
  "framework"        "ComplianceFramework"         NOT NULL,
  "control_ref"      TEXT                          NOT NULL,
  "title"            TEXT                          NOT NULL,
  "description"      TEXT,
  "category"         TEXT,
  "owner_user_id"    TEXT,
  "status"           "ComplianceControlStatus"     NOT NULL DEFAULT 'NOT_STARTED',
  "maturity"         "ComplianceControlMaturity"   NOT NULL DEFAULT 'POLICY',
  "test_procedure"   TEXT,
  "last_reviewed_at" TIMESTAMP(3),
  "next_review_due"  TIMESTAMP(3),
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)                  NOT NULL,
  CONSTRAINT "compliance_controls_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "compliance_controls_framework_control_ref_key" ON "compliance_controls"("framework","control_ref");
CREATE INDEX "compliance_controls_framework_idx" ON "compliance_controls"("framework");
CREATE INDEX "compliance_controls_status_idx" ON "compliance_controls"("status");
CREATE INDEX "compliance_controls_owner_user_id_idx" ON "compliance_controls"("owner_user_id");

CREATE TABLE "compliance_evidence" (
  "id"           TEXT                       PRIMARY KEY,
  "control_id"   TEXT                       NOT NULL,
  "type"         "ComplianceEvidenceType"   NOT NULL,
  "title"        TEXT                       NOT NULL,
  "description"  TEXT,
  "url"          TEXT,
  "blob_path"    TEXT,
  "period_start" TIMESTAMP(3),
  "period_end"   TIMESTAMP(3),
  "added_by_id"  TEXT,
  "added_at"     TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_evidence_control_id_fkey"
    FOREIGN KEY ("control_id") REFERENCES "compliance_controls"("id") ON DELETE CASCADE,
  CONSTRAINT "compliance_evidence_added_by_id_fkey"
    FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "compliance_evidence_control_id_idx" ON "compliance_evidence"("control_id");
CREATE INDEX "compliance_evidence_period_end_idx" ON "compliance_evidence"("period_end");

CREATE TABLE "compliance_gaps" (
  "id"            TEXT                     PRIMARY KEY,
  "control_id"    TEXT                     NOT NULL,
  "description"   TEXT                     NOT NULL,
  "severity"      "ComplianceGapSeverity"  NOT NULL DEFAULT 'MODERATE',
  "status"        "ComplianceGapStatus"    NOT NULL DEFAULT 'OPEN',
  "owner_user_id" TEXT,
  "remediation"   TEXT,
  "due_date"      TIMESTAMP(3),
  "identified_at" TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at"     TIMESTAMP(3),
  CONSTRAINT "compliance_gaps_control_id_fkey"
    FOREIGN KEY ("control_id") REFERENCES "compliance_controls"("id") ON DELETE CASCADE,
  CONSTRAINT "compliance_gaps_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "compliance_gaps_control_id_idx" ON "compliance_gaps"("control_id");
CREATE INDEX "compliance_gaps_status_idx" ON "compliance_gaps"("status");
CREATE INDEX "compliance_gaps_severity_idx" ON "compliance_gaps"("severity");

CREATE TABLE "compliance_audit_periods" (
  "id"            TEXT                            PRIMARY KEY,
  "framework"     "ComplianceFramework"           NOT NULL,
  "period_start"  TIMESTAMP(3)                    NOT NULL,
  "period_end"    TIMESTAMP(3)                    NOT NULL,
  "assessor_org"  TEXT,
  "assessor_name" TEXT,
  "status"        "ComplianceAuditPeriodStatus"   NOT NULL DEFAULT 'PLANNING',
  "report_url"    TEXT,
  "notes"         TEXT,
  "created_at"    TIMESTAMP(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)                    NOT NULL
);
CREATE INDEX "compliance_audit_periods_framework_status_idx" ON "compliance_audit_periods"("framework","status");

-- ─── Seeded control catalog ────────────────────────────────────────────────
-- Ships a representative subset of HITRUST CSF v11 r2 control specs and the
-- SOC 2 Trust Services Criteria. Auditors expand this through the UI; we
-- seed enough so the first day after deploy isn't a blank slate.

INSERT INTO "compliance_controls" ("id","framework","control_ref","title","description","category","status","maturity","test_procedure","updated_at") VALUES
-- HITRUST r2 representative controls
(gen_random_uuid()::text,'HITRUST_R2','01.a','Access Control Policy','Documented access control policy reviewed annually.','Access Control','NOT_STARTED','POLICY','Inspect policy doc + last review date.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','01.j','User Authentication','Strong authentication (MFA) for all administrative interfaces.','Access Control','NOT_STARTED','POLICY','Sample admin accounts; verify MFA enforced.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','01.q','Access Termination','Process for terminating access within 24h of separation.','Access Control','NOT_STARTED','POLICY','Sample HR terminations and verify access removal.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','06.d','Audit Logging','Audit logs captured for PHI access and admin actions.','Logging','NOT_STARTED','POLICY','Inspect audit log feed; verify retention.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','09.aa','Data Encryption At Rest','PHI encrypted at rest using AES-256 or stronger.','Cryptography','NOT_STARTED','POLICY','Inspect database TDE settings + storage encryption.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','09.s','Data Encryption In Transit','TLS 1.2+ enforced for all PHI in transit.','Cryptography','NOT_STARTED','POLICY','Inspect ingress controller config and ciphers.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','10.k','Vulnerability Management','Quarterly vulnerability scans with remediation SLAs.','Vulnerability Mgmt','NOT_STARTED','POLICY','Inspect last 4 quarterly scan reports.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','11.a','Incident Response Plan','Documented IR plan exercised at least annually.','Incident Response','NOT_STARTED','POLICY','Inspect plan + last tabletop exercise minutes.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','12.c','Backup & Recovery','Backups taken at least daily with successful restore tests.','BCP/DR','NOT_STARTED','POLICY','Inspect backup logs + last restore test report.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'HITRUST_R2','13.k','Vendor Risk Management','Vendor risk assessments updated annually.','Vendor Mgmt','NOT_STARTED','POLICY','Sample 5 vendor files; verify last assessment.',CURRENT_TIMESTAMP),

-- SOC 2 Type II Trust Services Criteria
(gen_random_uuid()::text,'SOC2_TYPE_II','CC1.1','Demonstrates Commitment to Integrity','Board and management establish standards of conduct.','Control Environment','NOT_STARTED','POLICY','Inspect code of conduct; sample acknowledgements.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC2.1','Internal Communication','Management communicates information to support functioning of internal controls.','Communication','NOT_STARTED','POLICY','Inspect quarterly all-hands and policy updates.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC3.1','Specifies Suitable Objectives','Entity specifies objectives with sufficient clarity to enable risk identification.','Risk Assessment','NOT_STARTED','POLICY','Inspect annual risk assessment.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC5.1','Selects and Develops Control Activities','Entity selects and develops control activities that contribute to mitigation of risks.','Control Activities','NOT_STARTED','POLICY','Inspect control matrix.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC6.1','Logical Access Controls','Logical access security software / infrastructure restricts access.','Logical Access','NOT_STARTED','POLICY','Sample access reviews.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC6.6','External Threat Protection','Boundary protection systems exist for external threats.','Logical Access','NOT_STARTED','POLICY','Inspect WAF/firewall configs.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC7.2','Detection of System Events','Monitoring detects anomalies indicative of security events.','Operations','NOT_STARTED','POLICY','Inspect SIEM/IDS alerts and runbooks.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC7.4','Incident Response','Incidents are responded to and remediated in a timely manner.','Operations','NOT_STARTED','POLICY','Sample incident tickets and RCA docs.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC8.1','Change Management','Changes to infrastructure and software follow change-management process.','Change Mgmt','NOT_STARTED','POLICY','Sample 25 PRs/changes for approvals.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','CC9.2','Vendor Management','Entity assesses and manages risks associated with vendors.','Vendor Mgmt','NOT_STARTED','POLICY','Inspect vendor risk-tier assessments.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','A1.2','Availability — Capacity Management','Entity manages system capacity to meet processing requirements.','Availability','NOT_STARTED','POLICY','Inspect capacity reports for past period.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','C1.1','Confidentiality — Identification','Identifies and maintains confidential information to meet objectives.','Confidentiality','NOT_STARTED','POLICY','Sample data classification.',CURRENT_TIMESTAMP),
(gen_random_uuid()::text,'SOC2_TYPE_II','P1.1','Privacy — Notice','Entity provides notice about its privacy practices.','Privacy','NOT_STARTED','POLICY','Inspect Notice of Privacy Practices.',CURRENT_TIMESTAMP);
