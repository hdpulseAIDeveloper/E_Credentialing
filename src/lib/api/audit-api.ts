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
    },
  });
}
