/**
 * src/lib/cv/render-markdown.ts
 *
 * GitHub-flavored Markdown renderer. Used by the staff "preview" tab on
 * the provider page, and by the `/api/v1/providers/:id/cv.md` endpoint
 * (mounted in Wave 5.4 alongside the auditor package). Pure formatter.
 */

import type { Cv } from "./builder";

function escapeMd(s: string): string {
  // Escape Markdown control characters so provider-supplied strings do
  // not break the document structure.
  return s.replace(/([\\`*_{}\[\]()#+!|>~-])/g, "\\$1");
}

export function renderCvMarkdown(cv: Cv): string {
  const lines: string[] = [];

  lines.push(`# Curriculum vitae — ${escapeMd(cv.header.fullName)}`);
  lines.push("");

  // Contact block
  const contact: string[] = [];
  if (cv.header.npi) contact.push(`**NPI:** ${escapeMd(cv.header.npi)}`);
  if (cv.header.providerTypeLabel) {
    contact.push(`**Provider type:** ${escapeMd(cv.header.providerTypeLabel)}`);
  }
  if (cv.header.email) contact.push(`**Email:** ${escapeMd(cv.header.email)}`);
  if (cv.header.phone) contact.push(`**Phone:** ${escapeMd(cv.header.phone)}`);
  if (contact.length) {
    lines.push(contact.join("  \n"));
    lines.push("");
  }

  for (const section of cv.sections) {
    lines.push(`## ${escapeMd(section.title)}`);
    lines.push("");
    for (const e of section.entries) {
      const badgeStr =
        e.badges && e.badges.length
          ? ` _${e.badges.map(escapeMd).join(" · ")}_`
          : "";
      lines.push(`- **${escapeMd(e.primary)}**${badgeStr}`);
      if (e.secondary) {
        lines.push(`  ${escapeMd(e.secondary)}`);
      }
    }
    if (section.summary) {
      lines.push("");
      lines.push(`> ${escapeMd(section.summary)}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    `_Generated: ${new Date(cv.generatedAtIso).toLocaleString("en-US")}_`,
  );
  lines.push(`_${escapeMd(cv.footerBrand)}_`);
  lines.push("");
  return lines.join("\n");
}
