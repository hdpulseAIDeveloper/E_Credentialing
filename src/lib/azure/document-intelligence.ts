/**
 * Azure AI Document Intelligence (Form Recognizer) OCR client.
 * Analyzes uploaded credential documents and extracts structured data.
 */

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from "@azure/ai-form-recognizer";

let _client: DocumentAnalysisClient | null = null;

function getClient(): DocumentAnalysisClient {
  if (_client) return _client;

  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  if (!endpoint) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is not set");
  }

  // In production, use DefaultAzureCredential for managed identity.
  // For now, using the key-based approach with env var key.
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ?? "";

  _client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  return _client;
}

export interface OcrResult {
  fields: Record<string, string | null>;
  confidence: number;
  rawContent: string;
}

/**
 * Document type to model ID mapping.
 * Uses prebuilt models where available, falls back to general document model.
 */
const MODEL_MAP: Record<string, string> = {
  LICENSE: "prebuilt-idDocument",
  DEA_CERTIFICATE: "prebuilt-document",
  BOARD_CERTIFICATION: "prebuilt-document",
  MEDICAL_SCHOOL_DIPLOMA: "prebuilt-document",
  PROFESSIONAL_LIABILITY_INSURANCE: "prebuilt-document",
  DEFAULT: "prebuilt-document",
};

/**
 * Analyzes a document buffer using Azure Document Intelligence.
 * Returns structured field data and confidence score.
 */
export async function analyzeDocument(params: {
  content: Buffer;
  documentType: string;
  contentType: string;
}): Promise<OcrResult> {
  const client = getClient();
  const modelId = MODEL_MAP[params.documentType] ?? MODEL_MAP.DEFAULT;

  const poller = await client.beginAnalyzeDocument(modelId, params.content);

  const result = await poller.pollUntilDone();

  const fields: Record<string, string | null> = {};
  let totalConfidence = 0;
  let fieldCount = 0;

  if (result.documents && result.documents.length > 0) {
    const doc = result.documents[0];
    if (doc?.fields) {
      for (const [key, field] of Object.entries(doc.fields)) {
        if (field?.content) {
          fields[key] = field.content;
          if (field.confidence !== undefined) {
            totalConfidence += field.confidence;
            fieldCount++;
          }
        }
      }
    }
  }

  // Extract key-value pairs from the document
  if (result.keyValuePairs) {
    for (const kvp of result.keyValuePairs) {
      if (kvp.key?.content && kvp.value?.content) {
        fields[kvp.key.content] = kvp.value.content;
      }
    }
  }

  const confidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;
  const rawContent = result.content ?? "";

  return { fields, confidence, rawContent };
}

/**
 * Extracts expiration date from OCR results.
 * Checks multiple common field names.
 */
export function extractExpirationDate(
  ocrFields: Record<string, string | null>
): Date | null {
  const expiryFieldNames = [
    "ExpirationDate",
    "Expiry",
    "Expiration",
    "ExpiryDate",
    "ValidThrough",
    "ValidUntil",
    "Expires",
    "DateOfExpiry",
  ];

  for (const fieldName of expiryFieldNames) {
    const value = ocrFields[fieldName];
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}
