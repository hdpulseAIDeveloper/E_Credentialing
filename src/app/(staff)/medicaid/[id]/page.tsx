import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { MedicaidEnrollmentDetail } from "@/components/medicaid/MedicaidEnrollmentDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MedicaidDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const { id } = await params;

  let enrollment;
  try {
    enrollment = await api.medicaid.getById({ id });
  } catch {
    notFound();
  }

  if (!enrollment) notFound();

  return (
    <div className="space-y-6">
      <MedicaidEnrollmentDetail enrollment={enrollment} />
    </div>
  );
}
