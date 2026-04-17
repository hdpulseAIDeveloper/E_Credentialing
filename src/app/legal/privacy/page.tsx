import type { Metadata } from "next";
import { LegalDocumentRenderer } from "@/components/legal/LegalDocumentRenderer";
import { PRIVACY_NOTICE, PRIVACY_NOTICE_SUMMARY } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Privacy Notice — Essen Provider Credentialing Portal",
  description: PRIVACY_NOTICE_SUMMARY,
};

export default function PrivacyPage() {
  return <LegalDocumentRenderer document={PRIVACY_NOTICE} />;
}
