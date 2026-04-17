/**
 * P2 Gap #18 — Staff training assignment library.
 *
 * Pure functions + DB helpers for synchronizing the staff-training catalog
 * to per-user assignments. The job of this layer:
 *   • For each active staff user, ensure they have a TrainingAssignment row
 *     for every TrainingCourse whose `requiredForRoles` includes their role.
 *   • Compute due dates from the course frequency.
 *   • Recompute status (ASSIGNED → IN_PROGRESS → COMPLETED → OVERDUE)
 *     against existing StaffTrainingRecord completions.
 */

import type { PrismaClient, TrainingCourse, User } from "@prisma/client";

export interface SyncSummary {
  usersConsidered: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  errors: number;
}

const FREQUENCY_DAYS: Record<TrainingCourse["frequency"], number | null> = {
  ONE_TIME: null,
  ANNUAL: 365,
  EVERY_TWO_YEARS: 730,
  EVERY_THREE_YEARS: 1095,
};

function computeDueDate(course: TrainingCourse, base: Date): Date | null {
  const days = course.validityDays ?? FREQUENCY_DAYS[course.frequency];
  if (days == null) return null;
  const due = new Date(base);
  due.setDate(due.getDate() + days);
  return due;
}

/**
 * Re-derive a single assignment's status + dueDate from the user's most
 * recent record for that course.
 */
export async function reconcileAssignmentStatus(
  db: PrismaClient,
  assignmentId: string
): Promise<void> {
  const a = await db.trainingAssignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  if (!a) return;

  const lastRecord = await db.staffTrainingRecord.findFirst({
    where: {
      userId: a.userId,
      OR: [{ courseId: a.courseId }, { courseName: a.course.title }],
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
  });

  const now = new Date();
  let status: typeof a.status = a.status;
  let completedAt: Date | null = a.completedAt;
  let dueDate: Date | null = a.dueDate;

  if (lastRecord?.completedAt) {
    completedAt = lastRecord.completedAt;
    dueDate = computeDueDate(a.course, lastRecord.completedAt);
    status = "COMPLETED";
    if (dueDate && dueDate.getTime() < now.getTime()) {
      status = "OVERDUE";
    }
  } else if (a.dueDate && a.dueDate.getTime() < now.getTime()) {
    status = "OVERDUE";
  }

  await db.trainingAssignment.update({
    where: { id: a.id },
    data: { status, completedAt, dueDate, recordId: lastRecord?.id ?? null },
  });
}

/**
 * Sync assignments for one user: create rows for missing required courses,
 * reconcile status of existing rows.
 */
export async function syncAssignmentsForUser(
  db: PrismaClient,
  user: Pick<User, "id" | "role" | "isActive">
): Promise<{ created: number; updated: number }> {
  if (!user.isActive) return { created: 0, updated: 0 };

  const requiredCourses = await db.trainingCourse.findMany({
    where: {
      isActive: true,
      requiredForRoles: { has: user.role },
    },
  });

  let created = 0;
  let updated = 0;

  for (const course of requiredCourses) {
    const existing = await db.trainingAssignment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });

    if (!existing) {
      // 30 days from assignment is the default first-time deadline.
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const a = await db.trainingAssignment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          dueDate,
          status: "ASSIGNED",
        },
      });
      await reconcileAssignmentStatus(db, a.id);
      created += 1;
    } else {
      await reconcileAssignmentStatus(db, existing.id);
      updated += 1;
    }
  }

  return { created, updated };
}

/**
 * Full sweep: enumerate active staff and sync their assignments.
 */
export async function syncAllAssignments(
  db: PrismaClient
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    usersConsidered: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    errors: 0,
  };

  const users = await db.user.findMany({
    where: { isActive: true, role: { not: "PROVIDER" } },
    select: { id: true, role: true, isActive: true },
  });

  for (const u of users) {
    summary.usersConsidered += 1;
    try {
      const { created, updated } = await syncAssignmentsForUser(db, u);
      summary.assignmentsCreated += created;
      summary.assignmentsUpdated += updated;
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[TrainingSync] error syncing user ${u.id}:`,
        error
      );
    }
  }

  return summary;
}

/**
 * Compliance percentage = COMPLETED assignments / all current assignments.
 */
export async function getOrgComplianceSummary(db: PrismaClient): Promise<{
  totalAssignments: number;
  completed: number;
  overdue: number;
  inProgress: number;
  compliancePercent: number;
}> {
  const now = new Date();
  const [total, completed, overdue, inProgress] = await Promise.all([
    db.trainingAssignment.count(),
    db.trainingAssignment.count({ where: { status: "COMPLETED" } }),
    db.trainingAssignment.count({
      where: {
        OR: [
          { status: "OVERDUE" },
          { status: { not: "COMPLETED" }, dueDate: { lt: now } },
        ],
      },
    }),
    db.trainingAssignment.count({ where: { status: "IN_PROGRESS" } }),
  ]);
  const compliancePercent =
    total === 0 ? 100 : Math.round((completed / total) * 100);
  return { totalAssignments: total, completed, overdue, inProgress, compliancePercent };
}
