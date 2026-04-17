import type { Metadata } from "next";
import { LegalDocumentRenderer } from "@/components/legal/LegalDocumentRenderer";
import { TERMS_OF_SERVICE, TERMS_OF_SERVICE_SUMMARY } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Terms of Service — Essen Provider Credentialing Portal",
  description: TERMS_OF_SERVICE_SUMMARY,
};

export default function TermsPage() {
  return <LegalDocumentRenderer document={TERMS_OF_SERVICE} />;
}
