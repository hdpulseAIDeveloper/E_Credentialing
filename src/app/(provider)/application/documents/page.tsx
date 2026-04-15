"use client";

import { DocumentUploadZone } from "@/components/forms/DocumentUploadZone";

export default function DocumentsPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Documents</h2>
      <p className="text-gray-500 mb-8">
        Upload the required documents for your credentialing application. Documents are securely stored
        and accessible only to the credentialing team.
      </p>

      <DocumentUploadZone token={searchParams.token ?? ""} />
    </div>
  );
}
