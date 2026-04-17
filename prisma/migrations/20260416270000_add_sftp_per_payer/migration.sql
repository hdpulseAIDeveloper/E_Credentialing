-- P1 Gap #13: per-payer SFTP delivery + ack tracking

ALTER TABLE "payer_rosters"
  ADD COLUMN "sftp_host" TEXT,
  ADD COLUMN "sftp_port" INTEGER,
  ADD COLUMN "sftp_username" TEXT,
  ADD COLUMN "sftp_password_secret_ref" TEXT,
  ADD COLUMN "sftp_private_key_secret_ref" TEXT,
  ADD COLUMN "sftp_upload_dir" TEXT,
  ADD COLUMN "sftp_ack_dir" TEXT,
  ADD COLUMN "sftp_ack_pattern" TEXT,
  ADD COLUMN "sftp_host_key_fingerprint" TEXT,
  ADD COLUMN "sftp_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "roster_submissions"
  ADD COLUMN "remote_filename" TEXT,
  ADD COLUMN "remote_path" TEXT,
  ADD COLUMN "remote_size" INTEGER,
  ADD COLUMN "ack_filename" TEXT,
  ADD COLUMN "ack_content" TEXT,
  ADD COLUMN "ack_error_message" TEXT,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN "last_error" TEXT;

CREATE INDEX "roster_submissions_status_idx" ON "roster_submissions"("status");
