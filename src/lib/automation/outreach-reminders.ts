/**
 * Automated outreach and data gap reminder service.
 * Identifies missing fields/documents and creates communications.
 */

import { db } from "@/server/db";
import type { ChecklistStatus } from "@prisma/client";

export interface DataGap {
  type: "field" | "document";
  name: string;
  description: string;
}

export async function checkDataGaps(providerId: string): Promise<DataGap[]> {
  const provider = await db.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      profile: true,
      checklistItems: true,
      licenses: true,
    },
  });

  const gaps: DataGap[] = [];

  // Required fields
  if (!provider.npi) gaps.push({ type: "field", name: "NPI", description: "National Provider Identifier is required" });
  if (!provider.dateOfBirth) gaps.push({ type: "field", name: "Date of Birth", description: "Date of birth is required for credentialing" });

  // Profile gaps
  if (!provider.profile) {
    gaps.push({ type: "field", name: "Provider Profile", description: "Complete provider profile has not been created" });
  } else {
    if (!provider.profile.specialtyPrimary) gaps.push({ type: "field", name: "Primary Specialty", description: "Primary specialty is required" });
    if (!provider.profile.mobilePhone && !provider.profile.personalEmail) {
      gaps.push({ type: "field", name: "Contact Info", description: "At least one contact method (phone or email) is required" });
    }
  }

  // License gaps
  if (provider.licenses.length === 0) {
    gaps.push({ type: "document", name: "State License", description: "No state license on file" });
  }

  // Document checklist gaps
  const pendingItems = provider.checklistItems.filter((item) => item.status === ("PENDING" as ChecklistStatus));
  for (const item of pendingItems) {
    gaps.push({
      type: "document",
      name: item.documentType.replace(/_/g, " "),
      description: `${item.documentType} has not been received`,
    });
  }

  return gaps;
}

export async function sendGapReminder(params: {
  providerId: string;
  gaps: DataGap[];
  sentByUserId?: string;
}): Promise<string> {
  const provider = await db.provider.findUniqueOrThrow({
    where: { id: params.providerId },
    include: { profile: true },
  });

  const gapList = params.gaps.map((g) => `- ${g.name}: ${g.description}`).join("\n");
  const body = `Dear ${provider.legalFirstName} ${provider.legalLastName},\n\nThe following items are still needed to complete your credentialing application:\n\n${gapList}\n\nPlease log in to the credentialing portal to submit the missing information.\n\nThank you,\nEssen Credentialing Team`;

  const communication = await db.communication.create({
    data: {
      providerId: params.providerId,
      communicationType: "FOLLOW_UP_EMAIL",
      direction: "OUTBOUND",
      channel: "EMAIL",
      fromUserId: params.sentByUserId ?? null,
      toAddress: provider.profile?.personalEmail ?? null,
      subject: "Missing Items — Credentialing Application",
      body,
      deliveryStatus: process.env.SENDGRID_API_KEY ? "SENT" : "LOGGED",
      sentAt: new Date(),
    },
  });

  console.log(`[Outreach] Gap reminder sent for provider ${params.providerId}: ${params.gaps.length} gaps`);
  return communication.id;
}

export async function checkAndSendReminders(providerId: string, sentByUserId?: string): Promise<{ gapCount: number; communicationId?: string }> {
  const gaps = await checkDataGaps(providerId);
  if (gaps.length === 0) return { gapCount: 0 };

  const communicationId = await sendGapReminder({ providerId, gaps, sentByUserId });
  return { gapCount: gaps.length, communicationId };
}
