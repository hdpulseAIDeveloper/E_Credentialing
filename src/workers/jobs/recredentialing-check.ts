/**
 * Daily recredentialing check.
 * Marks overdue cycles and creates new cycles for providers approaching their due date.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function runRecredentialingCheck(): Promise<void> {
  console.log("[RecredentialingCheck] Starting daily recredentialing check...");

  try {
    const now = new Date();

    const overdueResult = await db.recredentialingCycle.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["PENDING", "APPLICATION_SENT", "IN_PROGRESS", "PSV_RUNNING"] },
      },
      data: { status: "OVERDUE" },
    });

    console.log(`[RecredentialingCheck] Marked ${overdueResult.count} cycles as OVERDUE.`);

    const threeMonthsOut = new Date();
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

    const approvedProviders = await db.provider.findMany({
      where: {
        status: "APPROVED",
        initialApprovalDate: { not: null },
      },
      select: {
        id: true,
        initialApprovalDate: true,
        recredentialingCycles: {
          where: {
            status: { in: ["PENDING", "APPLICATION_SENT", "IN_PROGRESS", "PSV_RUNNING", "COMMITTEE_READY"] },
          },
          select: { id: true },
        },
      },
    });

    let created = 0;
    for (const provider of approvedProviders) {
      if (provider.recredentialingCycles.length > 0) continue;
      if (!provider.initialApprovalDate) continue;

      const lastCycle = await db.recredentialingCycle.findFirst({
        where: { providerId: provider.id },
        orderBy: { cycleNumber: "desc" },
      });

      const cycleNumber = (lastCycle?.cycleNumber || 0) + 1;
      const baseDate = lastCycle?.dueDate || provider.initialApprovalDate;
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + 36);

      if (dueDate <= threeMonthsOut) {
        await db.recredentialingCycle.create({
          data: {
            providerId: provider.id,
            cycleNumber,
            cycleLengthMonths: 36,
            dueDate,
            status: "PENDING",
          },
        });
        created++;
      }
    }

    console.log(`[RecredentialingCheck] Created ${created} new recredentialing cycles.`);
    console.log("[RecredentialingCheck] Complete.");
  } catch (error) {
    console.error("[RecredentialingCheck] Error:", error);
    throw error;
  }
}
