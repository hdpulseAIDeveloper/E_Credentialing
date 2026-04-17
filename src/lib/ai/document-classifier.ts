/**
 * AI Document Classifier (P1 Gap #8)
 *
 * Suggests a DocumentType based on the uploaded file's filename and (when
 * available) extracted text. Always returns a suggestion plus a confidence
 * score in [0, 1] and a short human-readable reason.
 *
 * The classifier is layered:
 *   1) Filename keyword matcher  — runs always, no external service.
 *   2) Azure OpenAI fallback      — runs when AZURE_OPENAI_ENDPOINT is set
 *                                   and filename match confidence < 0.7.
 *
 * NCQA AI governance note: the classifier is advisory only. The uploader's
 * documentType is always trusted as the authoritative type; the suggestion
 * is surfaced in the UI so reviewers can spot mismatches and override.
 */

import type { DocumentType } from "@prisma/client";

export const CLASSIFIER_VERSION = "filename-keyword-v1";
export const CLASSIFIER_LLM_VERSION = "azure-openai-gpt-4o-mini-v1";

export interface ClassifierResult {
  documentType: DocumentType | null;
  confidence: number;
  reason: string;
  classifierVersion: string;
}

interface KeywordRule {
  type: DocumentType;
  /** Lowercased keywords; any single keyword match counts as a hit. */
  keywords: string[];
  /** Optional regex; weighted higher than plain keywords. */
  regex?: RegExp;
}

// Each rule is intentionally specific to reduce false positives. The order
// matters only for ties — we still pick the highest-score rule overall.
const RULES: KeywordRule[] = [
  // Identity & onboarding
  {
    type: "PHOTO_ID",
    keywords: ["driver license", "drivers license", "passport", "photo id", "state id"],
  },
  { type: "SSN_CARD", keywords: ["social security", "ssn card"] },
  { type: "CV_RESUME", keywords: ["cv", "resume", "curriculum vitae"] },

  // Insurance
  {
    type: "PROFESSIONAL_LIABILITY_INSURANCE",
    keywords: ["malpractice", "professional liability", "coi", "certificate of insurance", "coverage"],
  },

  // Licenses & registrations
  {
    type: "ORIGINAL_LICENSE",
    keywords: ["original license", "original medical license", "primary license"],
  },
  {
    type: "LICENSE_REGISTRATION",
    keywords: ["license registration", "license verification", "physician license", "state license"],
    regex: /\b[a-z]{2}\s?(license|medical board)\b/i,
  },
  { type: "DEA_CERTIFICATE", keywords: ["dea", "drug enforcement", "controlled substance"] },

  // Education
  {
    type: "MEDICAL_SCHOOL_DIPLOMA",
    keywords: ["diploma", "doctor of medicine", "medical school", "medical college"],
  },
  {
    type: "GRADUATE_CERTIFICATE",
    keywords: ["graduate certificate", "graduation certificate", "graduate"],
  },
  { type: "ECFMG_CERTIFICATE", keywords: ["ecfmg"] },
  { type: "INTERNSHIP_CERTIFICATE", keywords: ["internship"] },
  { type: "RESIDENCY_CERTIFICATE", keywords: ["residency"] },
  { type: "FELLOWSHIP_CERTIFICATE", keywords: ["fellowship"] },

  // Boards & CME
  {
    type: "BOARD_CERTIFICATION",
    keywords: ["board cert", "abim", "abfm", "nccpa", "abp", "abem", "abog", "abps", "diplomate"],
  },
  { type: "CME_CREDITS", keywords: ["cme", "continuing medical education", "category 1", "category 2"] },

  // Life support cards
  { type: "BLS_CARD", keywords: ["bls", "basic life support"] },
  { type: "ACLS_CARD", keywords: ["acls", "advanced cardiac life support"] },
  { type: "PALS_CARD", keywords: ["pals", "pediatric advanced life support"] },

  // Required NY trainings
  { type: "INFECTION_CONTROL_CERTIFICATE", keywords: ["infection control"] },
  { type: "CHILD_ABUSE_CERTIFICATE", keywords: ["child abuse", "mandated reporter"] },
  { type: "PAIN_MANAGEMENT_CERTIFICATE", keywords: ["pain management", "opioid"] },

  // Health screening
  { type: "PHYSICAL_EXAM_MMR", keywords: ["mmr", "measles", "mumps", "rubella"] },
  { type: "PHYSICAL_EXAM_PPD", keywords: ["ppd", "tuberculosis", "tb test", "quantiferon"] },
  { type: "CHEST_XRAY", keywords: ["chest x-ray", "chest xray", "cxr"] },
  { type: "FLU_SHOT", keywords: ["flu shot", "influenza vaccine", "flu vaccine"] },

  // Hospital privilege letters
  {
    type: "HOSPITAL_APPOINTMENT_LETTER",
    keywords: ["appointment letter", "initial appointment", "privileges granted"],
  },
  {
    type: "HOSPITAL_REAPPOINTMENT_LETTER",
    keywords: ["reappointment", "renewal of privileges", "privileges renewed"],
  },
];

function scoreFilename(filename: string, rule: KeywordRule): number {
  const lower = filename.toLowerCase();
  let score = 0;
  for (const kw of rule.keywords) {
    if (lower.includes(kw)) {
      // Exact word/phrase boundary match scores higher than substring.
      const wb = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
      score += wb.test(lower) ? 0.55 : 0.35;
    }
  }
  if (rule.regex && rule.regex.test(filename)) score += 0.4;
  return Math.min(score, 1);
}

export function classifyByFilename(filename: string): ClassifierResult {
  let best: { rule: KeywordRule; score: number } | null = null;
  for (const rule of RULES) {
    const score = scoreFilename(filename, rule);
    if (score > 0 && (!best || score > best.score)) best = { rule, score };
  }

  if (!best) {
    return {
      documentType: null,
      confidence: 0,
      reason: "No keyword matches in filename.",
      classifierVersion: CLASSIFIER_VERSION,
    };
  }

  return {
    documentType: best.rule.type,
    confidence: Number(best.score.toFixed(2)),
    reason:
      `Filename "${filename}" matched ${best.rule.type} keywords ` +
      `(score ${best.score.toFixed(2)}).`,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

/**
 * Optional Azure OpenAI fallback. Sends only the filename + a short text
 * sample (no PHI bodies) and asks the model to choose from a fixed enum.
 *
 * Returns null when no AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are set,
 * or when the network call fails. We never throw — classification is
 * advisory and must not block uploads.
 */
export async function classifyWithLlm(
  filename: string,
  textSample: string | null = null
): Promise<ClassifierResult | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
  if (!endpoint || !apiKey) return null;

  const allowedTypes = RULES.map((r) => r.type);
  const prompt =
    `You are a healthcare credentialing document classifier. Classify the ` +
    `attached document into EXACTLY ONE of these types:\n` +
    allowedTypes.join(", ") +
    `\n\nReturn JSON: {"type":"<one of the above>", "confidence":0..1, ` +
    `"reason":"<short>"}.\n\n` +
    `Filename: ${filename}\n` +
    (textSample
      ? `\nFirst-page text excerpt:\n${textSample.slice(0, 1500)}\n`
      : "");

  try {
    const url =
      `${endpoint.replace(/\/$/, "")}/openai/deployments/` +
      `${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Return only valid JSON, no prose." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as {
      type?: string;
      confidence?: number;
      reason?: string;
    };
    if (!parsed.type || !allowedTypes.includes(parsed.type as DocumentType)) {
      return null;
    }
    const confidence = Math.max(
      0,
      Math.min(1, typeof parsed.confidence === "number" ? parsed.confidence : 0.5)
    );
    return {
      documentType: parsed.type as DocumentType,
      confidence: Number(confidence.toFixed(2)),
      reason: parsed.reason ?? "LLM classification.",
      classifierVersion: CLASSIFIER_LLM_VERSION,
    };
  } catch (err) {
    console.error("[Classifier] LLM call failed:", err);
    return null;
  }
}

/**
 * Combined classification — runs the keyword matcher first, escalates to the
 * LLM only when filename confidence is low (<0.7) AND the LLM is configured.
 * Always succeeds (worst case: returns confidence 0 with reason).
 */
export async function classifyDocument(
  filename: string,
  textSample: string | null = null
): Promise<ClassifierResult> {
  const filenameResult = classifyByFilename(filename);
  if (filenameResult.confidence >= 0.7) return filenameResult;

  const llm = await classifyWithLlm(filename, textSample);
  if (llm && llm.confidence > filenameResult.confidence) return llm;
  return filenameResult;
}
