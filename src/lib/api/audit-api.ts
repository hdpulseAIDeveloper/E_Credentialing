/**
 * Audit-log helper for /api/v1 and /api/fhir requests.
 * Records every authenticated API key request to the AuditLog table.
 */
import { writeAuditLog } from "@/lib/audit";

export async function auditApiRequest(params: {
  apiKeyId: string;
  method: string;
  path: string;
  status: number;
  resultCount?: number;
  query?: Record<string, string | null>;
  /**
   * Wave 14 — `X-Request-Id` correlation id. Recorded so support
   * can join a customer-supplied id to the audit row in O(1).
   * Optional only for backwards-compat with callers that haven't
   * been updated yet.
   */
  requestId?: string;
}): Promise<void> {
  await writeAuditLog({
    actorId: null,
    actorRole: "API_KEY",
    action: `api.${params.method.toLowerCase()}`,
    entityType: "ApiRequest",
    entityId: params.apiKeyId,
    afterState: {
      method: params.method,
      path: params.path,
      status: params.status,
      resultCount: params.resultCount ?? null,
      query: params.query ?? null,
      requestId: params.requestId ?? null,
    },
  });
}
