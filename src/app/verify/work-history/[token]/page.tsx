import { db } from "@/server/db";
import { WorkHistoryResponseForm } from "@/components/public/WorkHistoryResponseForm";

export default async function WorkHistoryVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await db.workHistoryVerification.findUnique({
    where: { responseToken: token },
    include: {
      provider: {
        select: { legalFirstName: true, legalLastName: true },
      },
    },
  });

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900">Link Not Found</h1>
          <p className="text-gray-500 mt-2">This verification link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (record.status === "RECEIVED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-green-700">Already Submitted</h1>
          <p className="text-gray-500 mt-2">This verification has already been completed. Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Employment Verification Request</h1>
            <p className="text-gray-500 mt-2">
              Essen Medical Associates is verifying the employment history of{" "}
              <span className="font-semibold">{record.provider.legalFirstName} {record.provider.legalLastName}</span>.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Employer:</span> <span className="font-medium">{record.employerName}</span></div>
              <div><span className="text-gray-500">Position:</span> <span className="font-medium">{record.position || "—"}</span></div>
              <div><span className="text-gray-500">Start Date:</span> <span className="font-medium">{record.startDate ? new Date(record.startDate).toLocaleDateString() : "—"}</span></div>
              <div><span className="text-gray-500">End Date:</span> <span className="font-medium">{record.endDate ? new Date(record.endDate).toLocaleDateString() : "Present"}</span></div>
            </div>
          </div>
          <WorkHistoryResponseForm token={token} />
        </div>
      </div>
    </div>
  );
}
