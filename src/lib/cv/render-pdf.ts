/**
 * src/lib/cv/render-pdf.ts
 *
 * PDF renderer for the structured CV. Uses `pdf-lib` (already a dependency
 * because the SAM exclusions bot reads PDFs). Produces a single Letter-
 * size document with:
 *
 *   - title block (provider name + contact)
 *   - per-section heading + bullet list
 *   - automatic page breaks
 *   - footer brand on every page (CVO chain-of-custody requirement)
 *
 * Renderer is a pure async function: snapshot → buildCv → renderCvPdf →
 * Uint8Array. No filesystem IO, no network IO. Output is a complete PDF
 * byte buffer the caller can stream as `application/pdf`.
 *
 * Wave 3.2 (CVO platform). Wave 5.4 layers in the watermark + tamper-
 * evident HMAC stamp.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Cv } from "./builder";

// Letter size in PDF user-space units (1pt = 1/72").
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54; // 0.75"
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 28;

const SIZE_TITLE = 18;
const SIZE_H2 = 12;
const SIZE_BODY = 10;
const SIZE_SMALL = 8;
const LINE_GAP = 4;

// Greys
const COLOR_TEXT = rgb(0.13, 0.13, 0.16);
const COLOR_MUTED = rgb(0.45, 0.45, 0.5);
const COLOR_RULE = rgb(0.85, 0.85, 0.88);

interface RenderState {
  doc: PDFDocument;
  page: PDFPage;
  cursorY: number;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  pages: PDFPage[];
}

function newPage(state: RenderState): void {
  state.page = state.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.pages.push(state.page);
  state.cursorY = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(state: RenderState, needed: number): void {
  if (state.cursorY - needed < MARGIN + FOOTER_HEIGHT) {
    newPage(state);
  }
}

/**
 * Word-wrap `text` to fit `maxWidth` at the given font/size. Returns one
 * string per visual line.
 */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // If a single word still overflows, hard-break it.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawText(
  state: RenderState,
  text: string,
  opts: {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    indent?: number;
  } = {},
): void {
  const font = opts.font ?? state.font;
  const size = opts.size ?? SIZE_BODY;
  const color = opts.color ?? COLOR_TEXT;
  const indent = opts.indent ?? 0;
  const lines = wrap(text, font, size, CONTENT_WIDTH - indent);
  for (const line of lines) {
    ensureSpace(state, size + LINE_GAP);
    state.page.drawText(line, {
      x: MARGIN + indent,
      y: state.cursorY - size,
      size,
      font,
      color,
    });
    state.cursorY -= size + LINE_GAP;
  }
}

function drawRule(state: RenderState): void {
  ensureSpace(state, 6);
  state.page.drawLine({
    start: { x: MARGIN, y: state.cursorY - 2 },
    end: { x: MARGIN + CONTENT_WIDTH, y: state.cursorY - 2 },
    thickness: 0.5,
    color: COLOR_RULE,
  });
  state.cursorY -= 6;
}

function drawSpacer(state: RenderState, h: number): void {
  ensureSpace(state, h);
  state.cursorY -= h;
}

function drawFooter(state: RenderState, footerText: string): void {
  for (let i = 0; i < state.pages.length; i++) {
    const page = state.pages[i]!;
    const text = `${footerText}   ·   Page ${i + 1} of ${state.pages.length}`;
    page.drawText(text, {
      x: MARGIN,
      y: MARGIN / 2,
      size: SIZE_SMALL,
      font: state.fontItalic,
      color: COLOR_MUTED,
    });
  }
}

export async function renderCvPdf(cv: Cv): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Curriculum Vitae — ${cv.header.fullName}`);
  doc.setSubject("Curriculum Vitae");
  doc.setProducer("ESSEN Credentialing CVO Platform");
  doc.setCreator("ESSEN Credentialing CVO Platform");
  doc.setCreationDate(new Date(cv.generatedAtIso));

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const state: RenderState = {
    doc,
    page: firstPage,
    cursorY: PAGE_HEIGHT - MARGIN,
    font,
    fontBold,
    fontItalic,
    pages: [firstPage],
  };

  // Title
  drawText(state, "Curriculum Vitae", {
    font: fontBold,
    size: SIZE_TITLE,
  });
  drawText(state, cv.header.fullName, {
    font: fontBold,
    size: SIZE_H2 + 2,
  });
  // Contact
  const contactBits: string[] = [];
  if (cv.header.npi) contactBits.push(`NPI ${cv.header.npi}`);
  if (cv.header.providerTypeLabel) contactBits.push(cv.header.providerTypeLabel);
  if (cv.header.email) contactBits.push(cv.header.email);
  if (cv.header.phone) contactBits.push(cv.header.phone);
  if (contactBits.length) {
    drawText(state, contactBits.join("  ·  "), {
      font: fontItalic,
      size: SIZE_BODY,
      color: COLOR_MUTED,
    });
  }
  drawSpacer(state, 6);
  drawRule(state);
  drawSpacer(state, 6);

  // Sections
  for (const section of cv.sections) {
    ensureSpace(state, SIZE_H2 + LINE_GAP + 6);
    drawText(state, section.title.toUpperCase(), {
      font: fontBold,
      size: SIZE_H2,
    });
    drawRule(state);
    drawSpacer(state, 2);
    for (const e of section.entries) {
      const badgeStr =
        e.badges && e.badges.length ? `   [${e.badges.join(", ")}]` : "";
      drawText(state, `${e.primary}${badgeStr}`, {
        font: fontBold,
        size: SIZE_BODY,
      });
      if (e.secondary) {
        drawText(state, e.secondary, {
          size: SIZE_BODY,
          color: COLOR_MUTED,
          indent: 8,
        });
      }
      drawSpacer(state, 2);
    }
    if (section.summary) {
      drawSpacer(state, 2);
      drawText(state, section.summary, {
        font: fontItalic,
        size: SIZE_BODY,
        color: COLOR_MUTED,
      });
    }
    drawSpacer(state, 8);
  }

  // Footer brand on every page
  const generated = new Date(cv.generatedAtIso).toLocaleString("en-US");
  drawFooter(state, `${cv.footerBrand}   ·   Generated ${generated}`);

  return doc.save();
}
