import { db } from "@/server/db";
import { ReferenceResponseForm } from "@/components/public/ReferenceResponseForm";

export default async function ReferenceVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await db.professionalReference.findUnique({
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
          <p className="text-gray-500 mt-2">This reference link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (record.status === "RECEIVED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-green-700">Already Submitted</h1>
          <p className="text-gray-500 mt-2">This reference has already been completed. Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Professional Reference Request</h1>
            <p className="text-gray-500 mt-2">
              Essen Medical Associates is requesting a professional reference for{" "}
              <span className="font-semibold">{record.provider.legalFirstName} {record.provider.legalLastName}</span>.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Your Name:</span> <span className="font-medium">{record.referenceName}</span></div>
              <div><span className="text-gray-500">Title:</span> <span className="font-medium">{record.referenceTitle || "—"}</span></div>
              <div><span className="text-gray-500">Relationship:</span> <span className="font-medium">{record.relationship || "—"}</span></div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Please provide your honest assessment of the provider&apos;s qualifications and character.
            All responses are confidential and used solely for credentialing purposes.
          </p>
          <ReferenceResponseForm token={token} />
        </div>
      </div>
    </div>
  );
}
