-- Extend MonitoringAlertType for malpractice carrier verification.
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'MALPRACTICE_COVERAGE_BELOW_MIN';
ALTER TYPE "MonitoringAlertType" ADD VALUE IF NOT EXISTS 'MALPRACTICE_COVERAGE_LAPSED';
