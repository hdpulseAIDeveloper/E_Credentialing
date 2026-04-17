-- P1 Gap #9: Continuous Monitoring Alerts
-- New enums + monitoring_alerts table for SAM.gov webhook ingestion,
-- nightly state-board polls, NPDB Continuous Query alerts, and the
-- sanctions-30day sweep diff outputs.

CREATE TYPE "MonitoringAlertType" AS ENUM (
  'LICENSE_STATUS_CHANGE',
  'LICENSE_DISCIPLINARY_ACTION',
  'SAM_EXCLUSION_ADDED',
  'SAM_EXCLUSION_REMOVED',
  'OIG_EXCLUSION_ADDED',
  'STATE_MEDICAID_EXCLUSION_ADDED',
  'NPDB_NEW_REPORT',
  'BOARD_CERT_LAPSED',
  'DEA_STATUS_CHANGE'
);

CREATE TYPE "MonitoringAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TYPE "MonitoringAlertStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "monitoring_alerts" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "type" "MonitoringAlertType" NOT NULL,
  "severity" "MonitoringAlertSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "MonitoringAlertStatus" NOT NULL DEFAULT 'OPEN',
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monitoring_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monitoring_alerts_provider_id_idx" ON "monitoring_alerts"("provider_id");
CREATE INDEX "monitoring_alerts_status_idx" ON "monitoring_alerts"("status");
CREATE INDEX "monitoring_alerts_severity_idx" ON "monitoring_alerts"("severity");
CREATE INDEX "monitoring_alerts_detected_at_idx" ON "monitoring_alerts"("detected_at");

ALTER TABLE "monitoring_alerts"
  ADD CONSTRAINT "monitoring_alerts_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "monitoring_alerts"
  ADD CONSTRAINT "monitoring_alerts_acknowledged_by_fkey"
    FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monitoring_alerts"
  ADD CONSTRAINT "monitoring_alerts_resolved_by_fkey"
    FOREIGN KEY ("resolved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
