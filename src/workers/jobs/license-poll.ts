/**
 * Nightly license verification poll.
 * Re-verifies licenses expiring within 90 days for approved providers.
 */

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis";

const db = new PrismaClient();

export async function runLicensePoll(): Promise<void> {
  console.log("[LicensePoll] Starting nightly license poll...");

  const queue = new Queue("psv-bot", { connection: createRedisConnection() });
  let queued = 0;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 90);

    const licenses = await db.license.findMany({
      where: {
        status: "ACTIVE",
        expirationDate: { lte: cutoff },
        provider: { status: "APPROVED" },
      },
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true, npi: true },
        },
      },
    });

    console.log(`[LicensePoll] Found ${licenses.length} licenses expiring within 90 days.`);

    for (const license of licenses) {
      const lastVerification = await db.verificationRecord.findFirst({
        where: {
          providerId: license.provider.id,
          credentialType: "LICENSE",
          verifiedDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (lastVerification) continue;

      const botRun = await db.botRun.create({
        data: {
          providerId: license.provider.id,
          botType: "LICENSE_VERIFICATION",
          triggeredBy: "AUTOMATIC",
          status: "QUEUED",
          attemptCount: 0,
          inputData: {
            licenseId: license.id,
            state: license.state,
            licenseNumber: license.licenseNumber,
            firstName: license.provider.legalFirstName,
            lastName: license.provider.legalLastName,
            triggeredBy: "automatic_nightly",
          },
        },
      });

      await queue.add("license-verification", {
        botRunId: botRun.id,
        providerId: license.provider.id,
      }, {
        priority: 5,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      queued++;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(`[LicensePoll] Complete. Queued ${queued} license verifications.`);
  } catch (error) {
    console.error("[LicensePoll] Error:", error);
    throw error;
  } finally {
    await queue.close();
  }
}
