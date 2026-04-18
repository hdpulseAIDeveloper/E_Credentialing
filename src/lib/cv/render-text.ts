/**
 * src/lib/cv/render-text.ts
 *
 * Plain-text (ASCII) renderer. Intentionally close to the historical
 * `cme.generateCv` output so any existing consumer (legacy email
 * templates, the staff "view as text" preview) keeps working.
 */

import type { Cv } from "./builder";

const HR = "═".repeat(60);
const SUB = "─".repeat(40);

export function renderCvText(cv: Cv): string {
  const lines: string[] = [];

  lines.push(HR);
  lines.push("CURRICULUM VITAE");
  lines.push(HR);
  lines.push("");

  // Header
  lines.push("CONTACT INFORMATION");
  lines.push(SUB);
  lines.push(`Name: ${cv.header.fullName}`);
  if (cv.header.npi) lines.push(`NPI: ${cv.header.npi}`);
  if (cv.header.providerTypeLabel) {
    lines.push(`Provider Type: ${cv.header.providerTypeLabel}`);
  }
  if (cv.header.email) lines.push(`Email: ${cv.header.email}`);
  if (cv.header.phone) lines.push(`Phone: ${cv.header.phone}`);
  lines.push("");

  // Sections
  for (const section of cv.sections) {
    lines.push(section.title.toUpperCase());
    lines.push(SUB);
    for (const e of section.entries) {
      const badges =
        e.badges && e.badges.length ? ` [${e.badges.join(", ")}]` : "";
      lines.push(`${e.primary}${badges}`);
      if (e.secondary) {
        lines.push(`  ${e.secondary}`);
      }
    }
    if (section.summary) {
      lines.push("");
      lines.push(section.summary);
    }
    lines.push("");
  }

  lines.push(HR);
  lines.push(
    `Generated: ${new Date(cv.generatedAtIso).toLocaleString("en-US")}`,
  );
  lines.push(cv.footerBrand);
  lines.push(HR);
  return lines.join("\n");
}
