import type { Metadata } from "next";
import { LegalDocumentRenderer } from "@/components/legal/LegalDocumentRenderer";
import { COOKIE_NOTICE, COOKIE_NOTICE_SUMMARY } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Cookie & Session Notice — Essen Provider Credentialing Portal",
  description: COOKIE_NOTICE_SUMMARY,
};

export default function CookiesPage() {
  return <LegalDocumentRenderer document={COOKIE_NOTICE} />;
}
