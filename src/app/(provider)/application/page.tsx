"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApplicationForm } from "@/components/forms/ApplicationForm";

const tokenSchema = z.object({
  token: z.string(),
});

export default function ApplicationPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [section, setSection] = useState(0);

  const SECTIONS = [
    "Personal Info",
    "Contact",
    "Professional IDs",
    "Education",
    "Board Certifications",
    "Work History",
    "Malpractice",
    "Hospital Affiliations",
    "Licenses",
    "Attestation",
  ];

  useEffect(() => {
    if (!searchParams.token) {
      setIsValid(false);
      return;
    }
    // Token validation happens server-side; assume valid if present
    setIsValid(true);
  }, [searchParams.token]);

  if (isValid === false) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Invalid or Expired Link</h2>
        <p className="text-gray-500 mt-2">
          This invitation link is invalid or has expired. Please contact your credentialing specialist.
        </p>
        <p className="text-sm text-gray-400 mt-4">cred_onboarding@essenmed.com</p>
      </div>
    );
  }

  if (isValid === null) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Provider Application</h2>
        <p className="text-gray-500 mt-1">
          Complete all sections and upload required documents. Your progress is saved automatically.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Section {section + 1} of {SECTIONS.length}</span>
          <span>{Math.round(((section + 1) / SECTIONS.length) * 100)}% complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-blue-600 rounded-full transition-all"
            style={{ width: `${((section + 1) / SECTIONS.length) * 100}%` }}
          />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {SECTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => setSection(i)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                i === section
                  ? "bg-blue-600 text-white border-blue-600"
                  : i < section
                  ? "bg-green-100 text-green-700 border-green-300"
                  : "bg-white text-gray-500 border-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <ApplicationForm
        section={section}
        onNext={() => setSection((s) => Math.min(s + 1, SECTIONS.length - 1))}
        onPrev={() => setSection((s) => Math.max(s - 1, 0))}
        token={searchParams.token ?? ""}
      />
    </div>
  );
}
