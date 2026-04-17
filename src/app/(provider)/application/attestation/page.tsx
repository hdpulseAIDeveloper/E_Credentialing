"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { formatDateTime } from "@/lib/format-date";
import {
  ATTESTATION_CONFIRMATION_BODY,
  ATTESTATION_CONFIRMATION_HEADING,
  ATTESTATION_HEADING,
  ATTESTATION_LEAD,
  ATTESTATION_QUESTIONS,
  ATTESTATION_SIGNATURE_DISCLAIMER,
  ESIGN_DISCLOSURE,
  LEGAL_COPY_VERSION,
} from "@/lib/legal/copy";

interface AttestationForm {
  attestations: boolean[];
  electronicSignature: string;
}

export default function AttestationPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400">Loading...</div>}>
      <AttestationContent />
    </Suspense>
  );
}

function AttestationContent() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedAt, setSignedAt] = useState<string>("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { register, handleSubmit, formState: { errors } } = useForm<AttestationForm>();

  // Render the timestamp only after mount — avoids hydration mismatch since
  // `new Date()` on server and client produce different values.
  useEffect(() => {
    setSignedAt(formatDateTime(new Date()));
    const id = setInterval(() => setSignedAt(formatDateTime(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  const onSubmit = async (data: AttestationForm) => {
    setSubmitting(true);
    setError(null);
    try {
      const acknowledgements = ATTESTATION_QUESTIONS.map((question, i) => ({
        questionId: question.id,
        accepted: Boolean(data.attestations?.[i]),
      }));

      const response = await fetch("/api/attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          attestations: data.attestations,
          acknowledgements,
          electronicSignature: data.electronicSignature,
          legalCopyVersion: LEGAL_COPY_VERSION,
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
        <h2 className="text-xl font-semibold text-gray-900">{ATTESTATION_CONFIRMATION_HEADING}</h2>
        <p className="text-gray-500 mt-2 max-w-2xl mx-auto leading-relaxed">
          {ATTESTATION_CONFIRMATION_BODY}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{ATTESTATION_HEADING}</h2>
      <p className="text-gray-500 mb-8 leading-relaxed">{ATTESTATION_LEAD}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          {ATTESTATION_QUESTIONS.map((question, i) => (
            <label key={question.id} className="flex gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register(`attestations.${i}`, { required: true })}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600"
                aria-describedby={`attestation-${question.id}-text`}
              />
              <span
                id={`attestation-${question.id}-text`}
                className="text-sm text-gray-700 leading-relaxed"
              >
                <span className="font-semibold text-gray-900 mr-1.5">{question.id}.</span>
                {question.text}
              </span>
            </label>
          ))}
          {errors.attestations ? (
            <p className="text-red-600 text-sm">
              You must acknowledge every statement above to submit your application.
            </p>
          ) : null}
        </div>

        <EsignDisclosurePanel />

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Electronic Signature</h3>
          <div>
            <label
              htmlFor="electronicSignature"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Legal Name (as electronic signature)
            </label>
            <input
              id="electronicSignature"
              type="text"
              {...register("electronicSignature", { required: "Signature is required" })}
              placeholder="Type your full legal name"
              className="w-full border rounded-lg px-3 py-2 text-gray-900 text-lg"
              style={{ fontFamily: "cursive" }}
              autoComplete="name"
            />
            {errors.electronicSignature && (
              <p className="text-red-500 text-sm mt-1">{errors.electronicSignature.message}</p>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {ATTESTATION_SIGNATURE_DISCLAIMER}
          </p>
          <p className="text-xs text-gray-400">
            Date and time will be recorded automatically:{" "}
            <span suppressHydrationWarning>{signedAt || "—"}</span>
            <br />
            Legal copy version signed: <span className="font-mono">{LEGAL_COPY_VERSION}</span>
          </p>
        </div>

        <p className="text-xs text-gray-500 text-center">
          By submitting, you agree to the{" "}
          <Link href="/legal/terms" className="text-blue-700 underline hover:text-blue-900" target="_blank">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/legal/privacy" className="text-blue-700 underline hover:text-blue-900" target="_blank">
            Privacy Notice
          </Link>
          , and the Electronic Signature Disclosure shown above.
        </p>

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

function EsignDisclosurePanel() {
  return (
    <details className="bg-white rounded-lg border p-6 group">
      <summary className="cursor-pointer list-none flex justify-between items-center gap-4">
        <span className="font-semibold text-gray-900">{ESIGN_DISCLOSURE.heading}</span>
        <span className="text-xs text-gray-500 group-open:hidden">Show details</span>
        <span className="text-xs text-gray-500 hidden group-open:inline">Hide details</span>
      </summary>
      <div className="mt-4 space-y-4 text-sm text-gray-700 leading-relaxed">
        <p>{ESIGN_DISCLOSURE.intro}</p>
        <ol className="list-decimal ml-6 space-y-3">
          {ESIGN_DISCLOSURE.sections.map((section) => (
            <li key={section.title}>
              <span className="font-semibold text-gray-900">{section.title}</span>{" "}
              {section.body.map((paragraph, pi) => (
                <span key={pi}>{paragraph}{pi < section.body.length - 1 ? " " : ""}</span>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
