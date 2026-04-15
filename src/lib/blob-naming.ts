/**
 * Blob naming conventions matching the legacy K: drive format.
 * All file names produced by PSV bots follow these conventions.
 */

import { format } from "date-fns";

/**
 * Formats a date for use in blob filenames: MM.DD.YYYY
 */
function formatDate(date: Date): string {
  return format(date, "MM.dd.yyyy");
}

/**
 * License verification PDF filename.
 * Example: "NY License Verification, Exp. 03.31.2027"
 */
export function licenseVerificationFilename(state: string, expirationDate: Date): string {
  return `${state} License Verification, Exp. ${formatDate(expirationDate)}`;
}

/**
 * DEA verification PDF filename.
 * Example: "DEA Verification, Exp. 06.30.2026"
 */
export function deaVerificationFilename(expirationDate: Date): string {
  return `DEA Verification, Exp. ${formatDate(expirationDate)}`;
}

/**
 * Board certification verification PDF filename.
 * Example: "Boards Verification NCCPA exp 12.31.2027"
 */
export function boardVerificationFilename(board: string, expirationDate: Date): string {
  return `Boards Verification ${board} exp ${formatDate(expirationDate)}`;
}

/**
 * OIG sanctions check PDF filename.
 * Example: "OIG Sanctions Check 04.14.2026"
 */
export function oigSanctionsFilename(runDate: Date): string {
  return `OIG Sanctions Check ${formatDate(runDate)}`;
}

/**
 * SAM.gov sanctions check PDF filename.
 * Example: "SAM Sanctions Check 04.14.2026"
 */
export function samSanctionsFilename(runDate: Date): string {
  return `SAM Sanctions Check ${formatDate(runDate)}`;
}

/**
 * NPDB query report PDF filename.
 * Example: "NPDB Query 04.14.2026"
 */
export function npdbQueryFilename(queryDate: Date): string {
  return `NPDB Query ${formatDate(queryDate)}`;
}

/**
 * Bot run execution log blob path.
 */
export function botRunLogPath(providerId: string, botRunId: string): string {
  return `providers/${providerId}/verifications/bot-logs/${botRunId}.log`;
}

/**
 * Provider document blob path.
 */
export function documentBlobPath(providerId: string, documentId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "pdf";
  return `providers/${providerId}/documents/${documentId}.${ext}`;
}

/**
 * Verification PDF blob path (bot output).
 */
export function verificationBlobPath(providerId: string, filename: string): string {
  return `providers/${providerId}/verifications/${filename}.pdf`;
}

/**
 * Committee summary sheet blob path.
 */
export function committeeSummaryBlobPath(providerId: string, sessionId: string, version: number): string {
  return `providers/${providerId}/summaries/committee_summary_${sessionId}_v${version}.pdf`;
}

/**
 * Committee agenda blob path.
 */
export function committeeAgendaBlobPath(sessionId: string, version: number): string {
  return `providers/committee/agenda_${sessionId}_v${version}.pdf`;
}

/**
 * Enrollment roster blob path.
 */
export function enrollmentRosterBlobPath(enrollmentId: string, filename: string): string {
  return `enrollments/${enrollmentId}/${filename}`;
}
