-- P3 Gap #21 — FSMB Practitioner Data Center continuous monitoring

ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'FSMB_BOARD_ACTION';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'FSMB_LICENSE_STATUS_CHANGE';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'FSMB_DISCIPLINARY_REPORT';

CREATE TYPE "FsmbPdcSubscriptionStatus" AS ENUM (
  'ACTIVE',
  'PENDING',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE "FsmbPdcEventType" AS ENUM (
  'BOARD_ACTION',
  'LICENSE_STATUS_CHANGE',
  'DEMOGRAPHIC_UPDATE',
  'ADDRESS_UPDATE',
  'DISCIPLINARY_REPORT',
  'EDUCATION_UPDATE',
  'OTHER'
);

CREATE TYPE "FsmbPdcEventSeverity" AS ENUM (
  'INFO',
  'WARNING',
  'CRITICAL'
);

CREATE TYPE "FsmbPdcEventProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

CREATE TABLE "fsmb_pdc_subscriptions" (
  "id"                       TEXT                       PRIMARY KEY,
  "provider_id"              TEXT                       NOT NULL UNIQUE,
  "fsmb_id"                  TEXT,
  "status"                   "FsmbPdcSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "enrolled_at"              TIMESTAMP(3),
  "last_event_received_at"   TIMESTAMP(3),
  "last_synced_at"           TIMESTAMP(3),
  "cancelled_at"             TIMESTAMP(3),
  "notes"                    TEXT,
  "created_at"               TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3)               NOT NULL,

  CONSTRAINT "fsmb_pdc_subscriptions_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
);

CREATE INDEX "fsmb_pdc_subscriptions_status_idx" ON "fsmb_pdc_subscriptions"("status");

CREATE TABLE "fsmb_pdc_events" (
  "id"                  TEXT                            PRIMARY KEY,
  "provider_id"         TEXT                            NOT NULL,
  "external_event_id"   TEXT                            UNIQUE,
  "event_type"          "FsmbPdcEventType"              NOT NULL,
  "severity"            "FsmbPdcEventSeverity"          NOT NULL DEFAULT 'INFO',
  "occurred_at"         TIMESTAMP(3)                    NOT NULL,
  "received_at"         TIMESTAMP(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "state"               TEXT,
  "summary"             TEXT                            NOT NULL,
  "raw_payload"         JSONB                           NOT NULL,
  "processing_status"   "FsmbPdcEventProcessingStatus"  NOT NULL DEFAULT 'RECEIVED',
  "monitoring_alert_id" TEXT,
  "error_message"       TEXT,
  "created_at"          TIMESTAMP(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3)                    NOT NULL,

  CONSTRAINT "fsmb_pdc_events_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE
);

CREATE INDEX "fsmb_pdc_events_provider_id_idx" ON "fsmb_pdc_events"("provider_id");
CREATE INDEX "fsmb_pdc_events_event_type_idx" ON "fsmb_pdc_events"("event_type");
CREATE INDEX "fsmb_pdc_events_processing_status_idx" ON "fsmb_pdc_events"("processing_status");
CREATE INDEX "fsmb_pdc_events_occurred_at_idx" ON "fsmb_pdc_events"("occurred_at");
