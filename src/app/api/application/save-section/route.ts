/**
 * POST /api/application/save-section
 * Persists one section of the provider onboarding application form.
 * Authenticated via the invite JWT token (single-active-token; see verifyProviderInviteToken).
 *
 * PHI fields (SSN, date of birth) are AES-256-GCM encrypted before storage.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { encryptOptional } from "@/lib/encryption";
import {
  ProviderTokenError,
  verifyProviderInviteToken,
} from "@/lib/auth/provider-token";

export async function POST(req: NextRequest) {
  let providerId: string;
  let body: { token: string; section: number; data: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, section, data } = body;
  if (!token || section === undefined || !data) {
    return NextResponse.json(
      { error: "Missing token, section, or data" },
      { status: 400 }
    );
  }

  try {
    const verified = await verifyProviderInviteToken(token);
    providerId = verified.providerId;
  } catch (e) {
    if (e instanceof ProviderTokenError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
  }

  const provider = await db.provider.findUnique({
    where: { id: providerId },
    select: { id: true, status: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  try {
    switch (section) {
      case 0: {
        await db.provider.update({
          where: { id: providerId },
          data: {
            legalFirstName: typeof data.legalFirstName === "string" ? data.legalFirstName : undefined,
            legalLastName: typeof data.legalLastName === "string" ? data.legalLastName : undefined,
            legalMiddleName: typeof data.legalMiddleName === "string" ? data.legalMiddleName : null,
            gender: typeof data.gender === "string" ? data.gender : null,
            // PHI: encrypted at rest
            dateOfBirth: typeof data.dateOfBirth === "string" ? encryptOptional(data.dateOfBirth) : undefined,
            ssn: typeof data.ssn === "string" ? encryptOptional(data.ssn) : undefined,
            status: provider.status === "INVITED" ? "ONBOARDING_IN_PROGRESS" : undefined,
            applicationStartedAt: new Date(),
          },
        });
        break;
      }
      case 1: {
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            mobilePhone: (data.mobilePhone as string) || null,
            personalEmail: (data.personalEmail as string) || null,
            homeAddressLine1: (data.addressLine1 as string) || null,
            homeCity: (data.city as string) || null,
            homeState: (data.state as string) || null,
            homeZip: (data.zip as string) || null,
          },
          create: {
            providerId,
            mobilePhone: (data.mobilePhone as string) || null,
            personalEmail: (data.personalEmail as string) || null,
            homeAddressLine1: (data.addressLine1 as string) || null,
            homeCity: (data.city as string) || null,
            homeState: (data.state as string) || null,
            homeZip: (data.zip as string) || null,
          },
        });
        break;
      }
      case 2: {
        await db.provider.update({
          where: { id: providerId },
          data: {
            npi: (data.npi as string) || undefined,
            deaNumber: (data.deaNumber as string) || null,
            caqhId: (data.caqhId as string) || null,
            medicarePtan: (data.medicarePtan as string) || null,
            medicaidId: (data.medicaidId as string) || null,
          },
        });
        if (typeof data.ecfmgNumber === "string" && data.ecfmgNumber.length > 0) {
          await db.providerProfile.upsert({
            where: { providerId },
            update: { ecfmgNumber: data.ecfmgNumber },
            create: { providerId, ecfmgNumber: data.ecfmgNumber },
          });
        }
        break;
      }
      case 3: {
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            medicalSchoolName: (data.medicalSchoolName as string) || null,
            medicalSchoolCountry: (data.medicalSchoolCountry as string) || null,
            graduationYear: data.graduationYear ? parseInt(String(data.graduationYear), 10) : null,
          },
          create: {
            providerId,
            medicalSchoolName: (data.medicalSchoolName as string) || null,
            medicalSchoolCountry: (data.medicalSchoolCountry as string) || null,
            graduationYear: data.graduationYear ? parseInt(String(data.graduationYear), 10) : null,
          },
        });
        break;
      }
      case 8: {
        const licenses = (data.licenses as Array<Record<string, unknown>>) || [];
        await db.$transaction(
          licenses
            .filter((lic) => lic.state && lic.licenseNumber)
            .map((lic) =>
              db.license.create({
                data: {
                  providerId,
                  state: lic.state as string,
                  licenseNumber: lic.licenseNumber as string,
                  licenseType: (lic.licenseType as string) || "Medical (MD/DO)",
                  isPrimary: Boolean(lic.isPrimary),
                  issueDate: lic.issueDate ? new Date(String(lic.issueDate)) : null,
                  expirationDate: lic.expirationDate ? new Date(String(lic.expirationDate)) : null,
                  source: "MANUAL",
                },
              })
            )
        );
        break;
      }
      case 9: {
        await db.provider.update({
          where: { id: providerId },
          data: {
            applicationSubmittedAt: new Date(),
            status: "DOCUMENTS_PENDING",
          },
        });
        break;
      }
      default: {
        const existing = await db.providerProfile.findUnique({
          where: { providerId },
          select: { caqhDataSnapshot: true },
        });
        const snapshot = (existing?.caqhDataSnapshot as Record<string, unknown>) ?? {};
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            caqhDataSnapshot: { ...snapshot, [`applicationSection${section}`]: data },
          },
          create: {
            providerId,
            caqhDataSnapshot: { [`applicationSection${section}`]: data },
          },
        });
      }
    }

    return NextResponse.json({ success: true, section });
  } catch (err) {
    console.error("[save-section] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
