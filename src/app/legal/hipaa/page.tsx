import type { Metadata } from "next";
import Link from "next/link";
import {
  HIPAA_NOTICE_POINTER,
  LEGAL_COPY_LAST_REVIEWED_AT,
  LEGAL_COPY_STATUS,
  LEGAL_COPY_VERSION,
} from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "HIPAA Notice — Essen Provider Credentialing Portal",
  description:
    "Pointer to ESSEN Health Care's HIPAA Notice of Privacy Practices and " +
    "scope clarification for the Provider Credentialing Portal.",
};

export default function HipaaPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <header className="not-prose mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {HIPAA_NOTICE_POINTER.heading}
        </h1>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-3">
          <div>
            <dt className="inline font-semibold text-gray-700">Version: </dt>
            <dd className="inline">{LEGAL_COPY_VERSION}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-700">Status: </dt>
            <dd className="inline">{LEGAL_COPY_STATUS}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-700">Last reviewed: </dt>
            <dd className="inline">{LEGAL_COPY_LAST_REVIEWED_AT}</dd>
          </div>
        </dl>
      </header>

      <p className="text-sm leading-relaxed text-gray-700">
        {HIPAA_NOTICE_POINTER.body}
      </p>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">Where to read the full HIPAA NPP</h2>
      {HIPAA_NOTICE_POINTER.fullNoticeUrl ? (
        <p className="text-sm leading-relaxed text-gray-700">
          The full HIPAA Notice of Privacy Practices is published at{" "}
          <a
            href={HIPAA_NOTICE_POINTER.fullNoticeUrl}
            className="text-blue-700 underline hover:text-blue-900"
            rel="noreferrer noopener"
            target="_blank"
          >
            {HIPAA_NOTICE_POINTER.fullNoticeUrlLabel}
          </a>
          .
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-gray-700">
          The published URL of ESSEN&rsquo;s full HIPAA Notice of Privacy Practices
          is being confirmed by Legal. In the meantime, request a copy by
          email at{" "}
          <a
            href={`mailto:${HIPAA_NOTICE_POINTER.contact}`}
            className="text-blue-700 underline hover:text-blue-900"
          >
            {HIPAA_NOTICE_POINTER.contact}
          </a>
          .
        </p>
      )}

      <h2 className="mt-8 text-xl font-semibold text-gray-900">Provider information vs. patient PHI</h2>
      <p className="text-sm leading-relaxed text-gray-700">
        The information ESSEN collects from you through this Portal —
        identifiers, education, training, licensure, sanctions history, and
        related credentialing evidence — is described in the{" "}
        <Link href="/legal/privacy" className="text-blue-700 underline hover:text-blue-900">
          Privacy Notice
        </Link>
        . That information is governed by ESSEN&rsquo;s provider-data privacy
        program, not by the patient HIPAA NPP.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-gray-900">Contact</h2>
      <p className="text-sm leading-relaxed text-gray-700">
        Privacy questions:{" "}
        <a
          href={`mailto:${HIPAA_NOTICE_POINTER.contact}`}
          className="text-blue-700 underline hover:text-blue-900"
        >
          {HIPAA_NOTICE_POINTER.contact}
        </a>
        .
      </p>
    </article>
  );
}
