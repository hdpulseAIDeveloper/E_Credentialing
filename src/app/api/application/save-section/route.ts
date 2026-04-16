/**
 * POST /api/application/save-section
 * Persists one section of the provider onboarding application form.
 * Authenticated via the invite JWT token.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { db } from "@/server/db";

export async function POST(req: NextRequest) {
  try {
    const { token, section, data } = await req.json();

    if (!token || section === undefined || !data) {
      return NextResponse.json({ error: "Missing token, section, or data" }, { status: 400 });
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    let providerId: string;
    try {
      const { payload } = await jwtVerify(token, secret);
      providerId = payload.providerId as string;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { id: true, status: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    switch (section) {
      case 0: {
        // Personal Info
        await db.provider.update({
          where: { id: providerId },
          data: {
            legalFirstName: data.legalFirstName || undefined,
            legalLastName: data.legalLastName || undefined,
            legalMiddleName: data.legalMiddleName || null,
            gender: data.gender || null,
            status: provider.status === "INVITED" ? "ONBOARDING_IN_PROGRESS" : undefined,
            applicationStartedAt: new Date(),
          },
        });
        break;
      }
      case 1: {
        // Contact
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            mobilePhone: data.mobilePhone || null,
            personalEmail: data.personalEmail || null,
            homeAddressLine1: data.addressLine1 || null,
            homeCity: data.city || null,
            homeState: data.state || null,
            homeZip: data.zip || null,
          },
          create: {
            providerId,
            mobilePhone: data.mobilePhone || null,
            personalEmail: data.personalEmail || null,
            homeAddressLine1: data.addressLine1 || null,
            homeCity: data.city || null,
            homeState: data.state || null,
            homeZip: data.zip || null,
          },
        });
        break;
      }
      case 2: {
        // Professional IDs
        await db.provider.update({
          where: { id: providerId },
          data: {
            npi: data.npi || undefined,
            deaNumber: data.deaNumber || null,
            caqhId: data.caqhId || null,
            medicarePtan: data.medicarePtan || null,
            medicaidId: data.medicaidId || null,
          },
        });
        if (data.ecfmgNumber) {
          await db.providerProfile.upsert({
            where: { providerId },
            update: { ecfmgNumber: data.ecfmgNumber },
            create: { providerId, ecfmgNumber: data.ecfmgNumber },
          });
        }
        break;
      }
      case 3: {
        // Education
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            medicalSchoolName: data.medicalSchoolName || null,
            medicalSchoolCountry: data.medicalSchoolCountry || null,
            graduationYear: data.graduationYear ? parseInt(data.graduationYear) : null,
          },
          create: {
            providerId,
            medicalSchoolName: data.medicalSchoolName || null,
            medicalSchoolCountry: data.medicalSchoolCountry || null,
            graduationYear: data.graduationYear ? parseInt(data.graduationYear) : null,
          },
        });
        break;
      }
      case 8: {
        // Licenses — upsert each license
        const licenses = data.licenses || [];
        for (const lic of licenses) {
          if (!lic.state || !lic.licenseNumber) continue;
          await db.license.create({
            data: {
              providerId,
              state: lic.state,
              licenseNumber: lic.licenseNumber,
              licenseType: lic.licenseType || "Medical (MD/DO)",
              isPrimary: lic.isPrimary || false,
              issueDate: lic.issueDate ? new Date(lic.issueDate) : null,
              expirationDate: lic.expirationDate ? new Date(lic.expirationDate) : null,
              source: "MANUAL",
            },
          });
        }
        break;
      }
      case 9: {
        // Attestation — mark application as submitted
        await db.provider.update({
          where: { id: providerId },
          data: {
            applicationSubmittedAt: new Date(),
            status: "DOCUMENTS_PENDING",
          },
        });
        break;
      }
      default:
        // Sections 4-7 (boards, work history, malpractice, hospital affiliations)
        // stored as JSON snapshot on the profile for now
        await db.providerProfile.upsert({
          where: { providerId },
          update: {
            caqhDataSnapshot: {
              ...(await db.providerProfile.findUnique({ where: { providerId }, select: { caqhDataSnapshot: true } }))?.caqhDataSnapshot as Record<string, unknown> || {},
              [`applicationSection${section}`]: data,
            },
          },
          create: {
            providerId,
            caqhDataSnapshot: { [`applicationSection${section}`]: data },
          },
        });
    }

    return NextResponse.json({ success: true, section });
  } catch (err) {
    console.error("[save-section] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
