/**
 * eMedNY / NY Medicaid integration stubs.
 * These would be implemented as Playwright bot tasks in the worker container.
 * Stub returns mock results when EMEDNY_BOT_ENABLED is not set.
 */

const EMEDNY_BOT_ENABLED = process.env.EMEDNY_BOT_ENABLED === "true";

export interface EmednySubmissionResult {
  success: boolean;
  confirmationNumber?: string;
  message: string;
}

export async function submitMedicaidEnrollment(params: {
  providerName: string;
  npi: string;
  enrollmentPath: string;
  applicationData: Record<string, unknown>;
}): Promise<EmednySubmissionResult> {
  if (!EMEDNY_BOT_ENABLED) {
    console.warn("[eMedNY] Bot not enabled — stub logging submission for:", params.providerName, params.enrollmentPath);
    return {
      success: true,
      confirmationNumber: `EMEDNY-STUB-${Date.now()}`,
      message: "Stub: eMedNY submission simulated. Enable EMEDNY_BOT_ENABLED=true for real bot execution.",
    };
  }

  // Real implementation dispatches a BullMQ job to the worker container
  // which runs a Playwright script against the eMedNY Service Portal
  throw new Error("Real eMedNY bot execution must go through the worker queue");
}

export async function checkMedicaidStatus(params: {
  npi: string;
  providerName: string;
}): Promise<{ status: string; etinNumber?: string; message: string }> {
  if (!EMEDNY_BOT_ENABLED) {
    console.warn("[eMedNY] Bot not enabled — stub status check for:", params.npi);
    return {
      status: "PENDING",
      message: "Stub: eMedNY status check simulated",
    };
  }

  throw new Error("Real eMedNY bot execution must go through the worker queue");
}

export async function updateGroupAffiliation(params: {
  npi: string;
  providerName: string;
  etinNumber: string;
  groupNpi: string;
}): Promise<EmednySubmissionResult> {
  if (!EMEDNY_BOT_ENABLED) {
    console.warn("[eMedNY] Bot not enabled — stub group affiliation update for:", params.npi);
    return {
      success: true,
      confirmationNumber: `EMEDNY-AFF-STUB-${Date.now()}`,
      message: "Stub: Group affiliation update simulated",
    };
  }

  throw new Error("Real eMedNY bot execution must go through the worker queue");
}

export async function checkMaintenanceFile(params: {
  npi: string;
}): Promise<{ isInFile: boolean; message: string }> {
  if (!EMEDNY_BOT_ENABLED) {
    console.warn("[eMedNY] Bot not enabled — stub maintenance file check for:", params.npi);
    return { isInFile: false, message: "Stub: Maintenance file check simulated" };
  }

  throw new Error("Real eMedNY bot execution must go through the worker queue");
}
