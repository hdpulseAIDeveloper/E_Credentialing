"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

const ATTESTATION_QUESTIONS = [
  "I certify that all information provided in this application is complete, accurate, and true to the best of my knowledge.",
  "I understand that any misrepresentation or omission of material facts may result in denial or revocation of credentials.",
  "I have not had my license or privileges revoked, suspended, or restricted at any facility or by any licensing authority.",
  "I am not currently excluded from participation in any federal or state healthcare program.",
  "I do not have any pending investigations, disciplinary actions, or malpractice claims not disclosed in this application.",
  "I consent to Essen Medical conducting primary source verification of all credentials listed in this application.",
  "I understand that I am required to notify Essen Medical of any changes to the information in this application within 30 days.",
];

interface AttestationForm {
  attestations: boolean[];
  electronicSignature: string;
  signedDate: string;
}

export default function AttestationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { register, handleSubmit, formState: { errors } } = useForm<AttestationForm>();

  const onSubmit = async (data: AttestationForm) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          attestations: data.attestations,
          electronicSignature: data.electronicSignature,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Submission failed");
      }

      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Application Submitted</h2>
        <p className="text-gray-500 mt-2">
          Your credentialing application has been submitted. The Essen Medical credentialing team will
          review your application and contact you if additional information is needed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Attestation & Electronic Signature</h2>
      <p className="text-gray-500 mb-8">
        Please read and acknowledge each statement below, then provide your electronic signature.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          {ATTESTATION_QUESTIONS.map((question, i) => (
            <label key={i} className="flex gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register(`attestations.${i}`, { required: true })}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700 leading-relaxed">{question}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Electronic Signature</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Legal Name (as electronic signature)
            </label>
            <input
              type="text"
              {...register("electronicSignature", { required: "Signature is required" })}
              placeholder="Type your full legal name"
              className="w-full border rounded-lg px-3 py-2 text-gray-900 font-cursive text-lg"
              style={{ fontFamily: "cursive" }}
            />
            {errors.electronicSignature && (
              <p className="text-red-500 text-sm mt-1">{errors.electronicSignature.message}</p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            By typing your name above, you are electronically signing this attestation.
            Date and time will be recorded automatically: {new Date().toLocaleString()}
          </p>
        </div>

        <div className="flex justify-end">
          {error && <p className="text-red-500 text-sm mr-4 self-center">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
