/**
 * Hourly follow-up cadence job.
 * Checks EnrollmentFollowUp due dates, creates tasks and notifications.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export async function runFollowUpCadence(): Promise<void> {
  console.log("[FollowUpCadence] Running hourly follow-up cadence check...");
  const now = new Date();
  let tasksCreated = 0;

  try {
    // Find enrollments with past-due follow-up dates
    const overdueEnrollments = await db.enrollment.findMany({
      where: {
        followUpDueDate: { lte: now },
        status: { in: ["SUBMITTED", "PENDING_PAYER"] },
      },
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        assignedTo: { select: { id: true, displayName: true } },
        followUps: {
          orderBy: { followUpDate: "desc" },
          take: 1,
        },
      },
    });

    console.log(`[FollowUpCadence] Found ${overdueEnrollments.length} overdue enrollments`);

    for (const enrollment of overdueEnrollments) {
      // Find assignee (use enrollment assignee or fallback to a manager)
      const assigneeId = enrollment.assignedToId ?? (await db.user.findFirst({
        where: { role: "MANAGER", isActive: true },
        select: { id: true },
      }))?.id;

      if (!assigneeId) {
        console.warn(`[FollowUpCadence] No assignee for enrollment ${enrollment.id}`);
        continue;
      }

      // Check if a follow-up task already exists for this enrollment today
      const existingTask = await db.task.findFirst({
        where: {
          providerId: enrollment.providerId,
          title: { contains: enrollment.payerName },
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      });

      if (existingTask) continue;

      const lastFollowUp = enrollment.followUps[0];
      const daysSinceLastFollowUp = lastFollowUp
        ? Math.floor((now.getTime() - lastFollowUp.followUpDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Create follow-up task
      await db.task.create({
        data: {
          providerId: enrollment.providerId,
          title: `Follow up on ${enrollment.payerName} enrollment`,
          description: [
            `Enrollment for ${enrollment.provider.legalFirstName} ${enrollment.provider.legalLastName} with ${enrollment.payerName} is overdue for follow-up.`,
            `Status: ${enrollment.status}`,
            lastFollowUp
              ? `Last follow-up: ${lastFollowUp.followUpDate.toLocaleDateString()} (${daysSinceLastFollowUp} days ago) — ${lastFollowUp.outcome}`
              : "No follow-ups recorded yet.",
            `Submitted: ${enrollment.submittedAt?.toLocaleDateString() ?? "Not yet submitted"}`,
          ].join("\n"),
          assignedToId: assigneeId,
          priority: "HIGH",
          status: "OPEN",
          dueDate: now,
        },
      });

      tasksCreated++;

      // Update follow-up due date to next cadence
      const nextDueDate = new Date(now);
      nextDueDate.setDate(nextDueDate.getDate() + enrollment.followUpCadenceDays);

      await db.enrollment.update({
        where: { id: enrollment.id },
        data: { followUpDueDate: nextDueDate },
      });
    }

    console.log(`[FollowUpCadence] Complete. Created ${tasksCreated} follow-up tasks.`);
  } catch (error) {
    console.error("[FollowUpCadence] Error:", error);
    throw error;
  }
}
