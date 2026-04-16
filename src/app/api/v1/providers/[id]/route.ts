import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { authenticateApiKey } from "../../middleware";
import { auditApiRequest } from "@/lib/api/audit-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return auth.error;

  if (!auth.permissions?.["providers:read"]) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    select: {
      // PHI is never returned via the public API. Excluded fields: ssn,
      // dateOfBirth, deaNumber (until tokenized), notes.
      id: true,
      legalFirstName: true,
      legalLastName: true,
      legalMiddleName: true,
      npi: true,
      caqhId: true,
      status: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      providerType: { select: { name: true, abbreviation: true } },
      profile: {
        select: {
          specialtyPrimary: true,
          facilityAssignment: true,
          jobTitle: true,
        },
      },
      licenses: {
        select: {
          id: true,
          state: true,
          licenseType: true,
          status: true,
          expirationDate: true,
        },
      },
      enrollments: { select: { id: true, payerName: true, status: true, effectiveDate: true } },
      expirables: { select: { id: true, expirableType: true, status: true, expirationDate: true } },
    },
  });

  if (!provider) {
    void auditApiRequest({ apiKeyId: auth.keyId!, method: "GET", path: `/api/v1/providers/${id}`, status: 404 });
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: `/api/v1/providers/${id}`,
    status: 200,
    resultCount: 1,
  });

  return NextResponse.json({ data: provider });
}
