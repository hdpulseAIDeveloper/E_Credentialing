/**
 * src/lib/fppe.ts — backwards-compatible shim around EvaluationService.
 *
 * P2 Gap #17 — Joint Commission MS.08.01.01 helper. Historically this file
 * owned the auto-FPPE creation logic directly. After Wave 3.1 the canonical
 * implementation lives in `src/server/services/evaluation.ts` so that:
 *
 *   - the same audit-write contract is used regardless of who initiates the
 *     FPPE (router, worker, privilege-grant hook),
 *   - the logic is unit-testable without spinning up Prisma, and
 *   - there is exactly one chain-of-custody source for JC NPG-12 evidence.
 *
 * This shim is preserved so any pre-Wave-3.1 callers continue to work. New
 * code should construct `EvaluationService` directly and call
 * `createAutoFppeForPrivilege`.
 */

import type { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  EvaluationService,
  type CreateAutoFppeOptions,
} from "@/server/services/evaluation";

/**
 * Re-export so existing callers can keep importing the option type from the
 * historical lib path.
 */
export type { CreateAutoFppeOptions } from "@/server/services/evaluation";

/**
 * Default actor used when the auto-FPPE is triggered by a system event
 * (e.g. a privilege-approval hook running outside an HTTP request). Audit
 * rows still need a non-null actor; we use the dedicated `system` sentinel
 * so reviewers can distinguish auto-creates from human-initiated FPPEs.
 */
const SYSTEM_ACTOR = { id: "system", role: "SYSTEM" } as const;

export async function createAutoFppeForPrivilege(
  db: PrismaClient,
  privilegeId: string,
  options: CreateAutoFppeOptions = {},
): Promise<string | null> {
  const svc = new EvaluationService({
    db,
    audit: writeAuditLog,
    actor: SYSTEM_ACTOR,
  });
  return svc.createAutoFppeForPrivilege(privilegeId, options);
}
