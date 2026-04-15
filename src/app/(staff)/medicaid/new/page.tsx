import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { NewMedicaidEnrollmentWizard } from "@/components/medicaid/NewMedicaidEnrollmentWizard";

export default async function NewMedicaidEnrollmentPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const providers = await db.provider.findMany({
    where: { status: { in: ["APPROVED", "COMMITTEE_READY", "COMMITTEE_IN_REVIEW", "VERIFICATION_IN_PROGRESS"] } },
    include: { providerType: true },
    orderBy: [{ legalLastName: "asc" }, { legalFirstName: "asc" }],
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New NY Medicaid Enrollment</h1>
        <p className="text-gray-500 mt-1">Follow the decision flow to determine the correct enrollment path</p>
      </div>
      <NewMedicaidEnrollmentWizard
        providers={providers.map((p) => ({
          id: p.id,
          name: `${p.legalFirstName} ${p.legalLastName}`,
          type: p.providerType.abbreviation,
          npi: p.npi ?? "",
        }))}
      />
    </div>
  );
}
