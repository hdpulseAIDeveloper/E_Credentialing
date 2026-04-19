/**
 * Nightly expirables scan job.
 * Queries all Expirable records, updates status, creates alerts at 90/60/30/14/7 day thresholds.
 */

import { PrismaClient } from "@prisma/client";
import type { Expirable } from "@prisma/client";

const db = new PrismaClient();

const ALERT_THRESHOLDS = [90, 60, 30, 14, 7]; // days before expiry

function getDaysUntilExpiry(expirationDate: Date): number {
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getExpirableStatus(daysUntilExpiry: number): "CURRENT" | "EXPIRING_SOON" | "EXPIRED" {
  if (daysUntilExpiry < 0) return "EXPIRED";
  if (daysUntilExpiry <= 30) return "EXPIRING_SOON";
  return "CURRENT";
}

export async function runExpirablesScan(): Promise<void> {
  console.log("[ExpirablesScan] Starting nightly scan...");
  const runDate = new Date();
  let updated = 0;
  let alertsCreated = 0;

  try {
    // Query all non-renewed expirables
    const expirables = await db.expirable.findMany({
      where: {
        status: { notIn: ["RENEWED"] },
      },
      include: {
        provider: {
          include: { profile: true },
        },
      },
    });

    console.log(`[ExpirablesScan] Processing ${expirables.length} expirable records...`);

    for (const expirable of expirables) {
      const daysUntilExpiry = getDaysUntilExpiry(expirable.expirationDate);
      const newStatus = getExpirableStatus(daysUntilExpiry);

      // Update status if changed
      if (newStatus !== expirable.status) {
        await db.expirable.update({
          where: { id: expirable.id },
          data: { status: newStatus },
        });
        updated++;
      }

      // Create alert tasks at threshold days
      for (const threshold of ALERT_THRESHOLDS) {
        if (
          daysUntilExpiry >= threshold - 1 &&
          daysUntilExpiry <= threshold + 1
        ) {
          await createExpiryAlert(expirable, daysUntilExpiry);
          alertsCreated++;
        }
      }

      // Send provider outreach if needed (30-day threshold)
      if (
        daysUntilExpiry === 30 &&
        expirable.provider.profile?.personalEmail
      ) {
        await sendExpiryOutreach(expirable, daysUntilExpiry, expirable.provider.profile.personalEmail);
      }

      // Update next check date
      const nextCheckDays = daysUntilExpiry <= 30 ? 1 : daysUntilExpiry <= 60 ? 7 : 14;
      const nextCheckDate = new Date();
      nextCheckDate.setDate(nextCheckDate.getDate() + nextCheckDays);

      await db.expirable.update({
        where: { id: expirable.id },
        data: { nextCheckDate },
      });
    }

    console.log(`[ExpirablesScan] Complete. Updated: ${updated}, Alerts created: ${alertsCreated}`);
  } catch (error) {
    console.error("[ExpirablesScan] Error:", error);
    throw error;
  }
}

async function createExpiryAlert(expirable: Expirable, daysUntilExpiry: number): Promise<void> {
  // Find an admin or manager to assign the task to
  const assignee = await db.user.findFirst({
    where: { role: { in: ["MANAGER", "ADMIN"] }, isActive: true },
  });

  if (!assignee) {
    console.warn("[ExpirablesScan] No manager found to assign expiry task to");
    return;
  }

  // Check if a task for this expirable + threshold already exists today
  const existingTask = await db.task.findFirst({
    where: {
      providerId: expirable.providerId,
      title: { contains: expirable.expirableType },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
  });

  if (existingTask) return; // Already alerted today

  await db.task.create({
    data: {
      providerId: expirable.providerId,
      title: `${expirable.expirableType} expiring in ${daysUntilExpiry} days`,
      description: `Credential ${expirable.expirableType} expires on ${expirable.expirationDate.toLocaleDateString()}. Please initiate renewal.`,
      assignedToId: assignee.id,
      priority: daysUntilExpiry <= 14 ? "HIGH" : daysUntilExpiry <= 30 ? "MEDIUM" : "LOW",
      status: "OPEN",
      dueDate: expirable.expirationDate,
    },
  });
}

async function sendExpiryOutreach(
  expirable: Expirable,
  daysUntilExpiry: number,
  providerEmail: string
): Promise<void> {
  const provider = await db.provider.findUnique({ where: { id: expirable.providerId } });
  if (!provider) return;

  // Check if outreach was already sent recently (within 7 days)
  if (expirable.outreachSentAt) {
    const daysSinceOutreach = Math.floor(
      (Date.now() - expirable.outreachSentAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceOutreach < 7) return;
  }

  try {
    const { sendEmail } = await import("../../lib/email/sendgrid.js");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:6015";

    await sendEmail({
      to: providerEmail,
      subject: `Action required: ${expirable.expirableType} expiring in ${daysUntilExpiry} days`,
      html: `
        <p>Dear ${provider.legalFirstName} ${provider.legalLastName},</p>
        <p>Your <strong>${expirable.expirableType}</strong> expires on <strong>${expirable.expirationDate.toLocaleDateString()}</strong> — ${daysUntilExpiry} days from today.</p>
        <p>Please log in to the Essen credentialing portal to upload your renewal documentation: <a href="${appUrl}">${appUrl}</a></p>
        <p>If you have questions, contact us at cred_onboarding@essenmed.com.</p>
      `,
    });

    // Update outreach timestamp
    await db.expirable.update({
      where: { id: expirable.id },
      data: { outreachSentAt: new Date() },
    });

    console.log(`[ExpirablesScan] Outreach email sent for ${expirable.expirableType} to ${providerEmail}`);
  } catch (error) {
    console.error("[ExpirablesScan] Failed to send outreach email:", error);
  }
}
