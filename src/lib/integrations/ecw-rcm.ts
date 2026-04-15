/**
 * eClinicalWorks (eCW) RCM integration — push enrollment statuses.
 * Stub logs when ECW_RCM_API_URL is not set.
 */

const ECW_RCM_API_URL = process.env.ECW_RCM_API_URL;
const ECW_RCM_API_KEY = process.env.ECW_RCM_API_KEY;

export interface EcwEnrollmentPayload {
  providerNpi: string;
  providerName: string;
  payerName: string;
  enrollmentStatus: string;
  effectiveDate?: string;
  terminationDate?: string;
  payerProviderId?: string;
}

export async function pushEnrollmentStatus(payload: EcwEnrollmentPayload): Promise<{ success: boolean; message: string }> {
  if (!ECW_RCM_API_URL) {
    console.warn("[eCW/RCM] ECW_RCM_API_URL not set — stub logging enrollment push:", payload.providerNpi, payload.payerName, payload.enrollmentStatus);
    return { success: true, message: "Stub: eCW enrollment status push simulated" };
  }

  const response = await fetch(`${ECW_RCM_API_URL}/api/v1/enrollment-status`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ECW_RCM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`eCW RCM API error: ${response.status} ${response.statusText}`);
  return { success: true, message: "Enrollment status pushed to eCW RCM" };
}

export async function pushBulkEnrollmentStatuses(payloads: EcwEnrollmentPayload[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const payload of payloads) {
    try {
      await pushEnrollmentStatus(payload);
      success++;
    } catch (e) {
      console.error("[eCW/RCM] Failed to push:", payload.providerNpi, e);
      failed++;
    }
  }
  return { success, failed };
}
