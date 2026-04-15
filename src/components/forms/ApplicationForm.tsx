"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const sectionSchemas = [
  // 0: Personal Info
  z.object({
    legalFirstName: z.string().min(1, "Required"),
    legalLastName: z.string().min(1, "Required"),
    legalMiddleName: z.string().optional(),
    dateOfBirth: z.string().min(1, "Required"),
    gender: z.string().optional(),
    ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, "Format: XXX-XX-XXXX").optional(),
  }),
  // 1: Contact
  z.object({
    mobilePhone: z.string().min(10, "Required"),
    personalEmail: z.string().email("Invalid email"),
    homeAddressLine1: z.string().min(1, "Required"),
    homeCity: z.string().min(1, "Required"),
    homeState: z.string().min(2, "Required"),
    homeZip: z.string().min(5, "Required"),
  }),
  // Add more sections as needed
];

interface Props {
  section: number;
  onNext: () => void;
  onPrev: () => void;
  token: string;
}

const SECTION_FIELDS: Record<number, JSX.Element> = {};

export function ApplicationForm({ section, onNext, onPrev, token }: Props) {
  const schema = sectionSchemas[section] ?? z.object({});
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    resolver: zodResolver(schema),
  });

  // Auto-save every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[ApplicationForm] Auto-saving...");
      // In a full implementation, send to API
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const onSubmit = (data: unknown) => {
    console.log("[ApplicationForm] Section data:", data);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {section === 0 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal First Name *</label>
              <input
                {...register("legalFirstName")}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.legalFirstName ? "border-red-400" : ""}`}
              />
              {errors.legalFirstName && (
                <p className="text-red-500 text-xs mt-1">{String(errors.legalFirstName.message)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Last Name *</label>
              <input
                {...register("legalLastName")}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.legalLastName ? "border-red-400" : ""}`}
              />
              {errors.legalLastName && (
                <p className="text-red-500 text-xs mt-1">{String(errors.legalLastName.message)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input
                {...register("legalMiddleName")}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                {...register("dateOfBirth")}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.dateOfBirth ? "border-red-400" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SSN <span className="text-gray-400 text-xs">(XXX-XX-XXXX)</span>
              </label>
              <input
                {...register("ssn")}
                type="password"
                placeholder="XXX-XX-XXXX"
                autoComplete="off"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {section === 1 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Contact Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone *</label>
              <input
                {...register("mobilePhone")}
                type="tel"
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.mobilePhone ? "border-red-400" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email *</label>
              <input
                {...register("personalEmail")}
                type="email"
                className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.personalEmail ? "border-red-400" : ""}`}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Address *</label>
              <input
                {...register("homeAddressLine1")}
                placeholder="Street address"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              />
              <div className="grid grid-cols-3 gap-2">
                <input {...register("homeCity")} placeholder="City" className="border rounded-lg px-3 py-2 text-sm" />
                <input {...register("homeState")} placeholder="State" className="border rounded-lg px-3 py-2 text-sm" maxLength={2} />
                <input {...register("homeZip")} placeholder="ZIP" className="border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}

      {section >= 2 && section <= 8 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 text-lg mb-4">
            {["Professional IDs", "Education", "Board Certifications", "Work History", "Malpractice", "Hospital Affiliations", "Licenses"][section - 2]}
          </h3>
          <p className="text-gray-500 text-sm">
            This section will be expanded with the relevant fields. Please continue to the next section.
          </p>
        </div>
      )}

      {section === 9 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 text-lg mb-4">Attestation</h3>
          <p className="text-gray-500 text-sm mb-4">
            Please review and complete the attestation on the next page.
          </p>
          <a
            href={`/application/attestation?token=${token}`}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Continue to Attestation
          </a>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={section === 0}
          className="px-6 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Previous
        </button>
        {section < 9 && (
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save & Continue
          </button>
        )}
      </div>
    </form>
  );
}
