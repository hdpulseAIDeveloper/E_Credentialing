"use client";

import { useCallback, useState } from "react";

interface Props {
  token: string;
  providerId?: string;
}

interface UploadedFile {
  name: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

const DOCUMENT_TYPES = [
  { value: "PHOTO_ID", label: "Government Photo ID" },
  { value: "CV_RESUME", label: "CV / Resume" },
  { value: "ORIGINAL_LICENSE", label: "State Medical License" },
  { value: "DEA_CERTIFICATE", label: "DEA Certificate" },
  { value: "BOARD_CERTIFICATION", label: "Board Certification" },
  { value: "MEDICAL_SCHOOL_DIPLOMA", label: "Medical School Diploma" },
  { value: "RESIDENCY_CERTIFICATE", label: "Residency Certificate" },
  { value: "PROFESSIONAL_LIABILITY_INSURANCE", label: "Malpractice Insurance" },
  { value: "BLS_CARD", label: "BLS Card" },
  { value: "ACLS_CARD", label: "ACLS Card" },
  { value: "FLU_SHOT", label: "Flu Shot Record" },
];

export function DocumentUploadZone({ token, providerId }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [dragging, setDragging] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!selectedDocType) {
        alert("Please select a document type first");
        return;
      }

      const uploadedFile: UploadedFile = { name: file.name, status: "uploading" };
      setFiles((prev) => [...prev, uploadedFile]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", selectedDocType);
      formData.append("providerId", providerId ?? "");
      formData.append("source", "PROVIDER_UPLOAD");

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const error = await res.json() as { error?: string };
          setFiles((prev) =>
            prev.map((f) =>
              f.name === file.name ? { ...f, status: "error", error: error.error ?? "Upload failed" } : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.name === file.name ? { ...f, status: "success" } : f))
          );
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "error", error: "Network error" } : f
          )
        );
      }
    },
    [selectedDocType, providerId, token]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      selected.forEach(uploadFile);
    },
    [uploadFile]
  );

  return (
    <div className="space-y-6">
      {/* Document Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Document Type
        </label>
        <select
          value={selectedDocType}
          onChange={(e) => setSelectedDocType(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Choose document type...</option>
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-gray-600 font-medium">Drag and drop files here</p>
        <p className="text-gray-400 text-sm mt-1">or</p>
        <label className="mt-3 inline-block cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Choose Files
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-400 mt-3">PDF, JPEG, PNG, TIFF · Max 50MB</p>
      </div>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                f.status === "success" ? "bg-green-50 border-green-200" :
                f.status === "error" ? "bg-red-50 border-red-200" :
                "bg-gray-50 border-gray-200"
              }`}
            >
              <span className="text-sm font-medium truncate">{f.name}</span>
              <span className={`text-xs font-medium ${
                f.status === "success" ? "text-green-600" :
                f.status === "error" ? "text-red-600" :
                "text-gray-400"
              }`}>
                {f.status === "uploading" ? "Uploading..." :
                 f.status === "success" ? "Uploaded" :
                 f.error ?? "Error"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
