import { db } from "@/server/db";
import { CarrierResponseForm } from "@/components/public/CarrierResponseForm";

export const dynamic = "force-dynamic";

export default async function CarrierVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await db.malpracticeVerification.findUnique({
    where: { responseToken: token },
    include: {
      provider: {
        select: {
          legalFirstName: true,
          legalLastName: true,
          npi: true,
        },
      },
    },
  });

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900">Link Not Found</h1>
          <p className="text-gray-500 mt-2">
            This verification link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (record.status === "RECEIVED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-green-700">
            Already Submitted
          </h1>
          <p className="text-gray-500 mt-2">
            This coverage verification has already been completed. Thank you!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Malpractice Coverage Verification
            </h1>
            <p className="text-gray-500 mt-2">
              Essen Medical Associates is verifying malpractice coverage for{" "}
              <span className="font-semibold">
                {record.provider.legalFirstName} {record.provider.legalLastName}
              </span>
              {record.provider.npi ? ` (NPI ${record.provider.npi})` : ""}.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Carrier:</span>{" "}
                <span className="font-medium">{record.carrierName}</span>
              </div>
              <div>
                <span className="text-gray-500">Policy on file:</span>{" "}
                <span className="font-medium">
                  {record.policyNumber || "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Expected expiration:</span>{" "}
                <span className="font-medium">
                  {record.expectedExpDate
                    ? new Date(record.expectedExpDate).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Provider NPI:</span>{" "}
                <span className="font-medium">
                  {record.provider.npi || "—"}
                </span>
              </div>
            </div>
          </div>
          <CarrierResponseForm token={token} />
        </div>
      </div>
    </div>
  );
}
