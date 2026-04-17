/**
 * Lightweight RAG knowledge-base for the conversational assistants.
 *
 * Why no vector DB?
 *   The platform docs/planning/ corpus is small (≈10 markdown files,
 *   ~150KB total) and changes infrequently. Loading them once into memory
 *   and running BM25-ish keyword scoring is faster, deterministic, and has
 *   zero infrastructure cost. We can swap in pgvector / Azure AI Search
 *   later without changing the public API of this module.
 *
 * NCQA AI governance:
 *   - Returned chunks include `source` (file path) so every citation is
 *     traceable back to the authoritative document.
 *   - Knowledge is loaded from the on-disk docs/ tree only — never from
 *     PHI-bearing tables.
 */

import fs from "fs";
import path from "path";

export interface KnowledgeChunk {
  id: string;
  source: string; // e.g. "docs/planning/scope.md#PSV"
  heading: string;
  content: string;
  tokens: Set<string>;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "for", "on",
  "with", "as", "by", "at", "be", "are", "was", "were", "this", "that",
  "it", "from", "but", "if", "then", "so", "i", "we", "you", "they",
  "what", "how", "do", "does", "can", "should", "would", "could",
]);

const KB_ROOTS = [
  "docs/planning",
  // Top-level CLAUDE.md doubles as a high-quality overview document.
  "CLAUDE.md",
];

let CACHE: KnowledgeChunk[] | null = null;
let CACHE_LOADED_AT = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s/_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/**
 * Splits a markdown document into chunks at H2 / H3 headings, keeping
 * roughly 300-800 character chunks for retrieval granularity.
 */
function chunkMarkdown(filePath: string, raw: string): KnowledgeChunk[] {
  const lines = raw.split(/\r?\n/);
  const chunks: KnowledgeChunk[] = [];
  let currentHeading = path.basename(filePath);
  let buffer: string[] = [];
  let headingPath: string[] = [currentHeading];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content.length < 40) return;
    const heading = headingPath.join(" › ");
    chunks.push({
      id: `${filePath}#${chunks.length}`,
      source: `${filePath}#${heading}`,
      heading,
      content,
      tokens: tokenize(`${heading} ${content}`),
    });
  };

  for (const line of lines) {
    const m = /^(#{1,4})\s+(.+)$/.exec(line);
    if (m) {
      flush();
      buffer = [];
      const depth = m[1]!.length;
      const text = m[2]!.trim();
      if (depth === 1) headingPath = [text];
      else headingPath = [headingPath[0] ?? currentHeading, text];
      currentHeading = text;
      continue;
    }
    buffer.push(line);
    // Soft chunk if buffer gets too long.
    if (buffer.join("\n").length > 1200) {
      flush();
      buffer = [];
    }
  }
  flush();
  return chunks;
}

function loadKnowledgeBase(): KnowledgeChunk[] {
  if (CACHE && Date.now() - CACHE_LOADED_AT < CACHE_TTL_MS) return CACHE;

  const cwd = process.cwd();
  const all: KnowledgeChunk[] = [];

  for (const root of KB_ROOTS) {
    const abs = path.resolve(cwd, root);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    const files: string[] = [];
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(abs)) {
        if (entry.endsWith(".md")) files.push(path.join(abs, entry));
      }
    } else if (stat.isFile()) {
      files.push(abs);
    }
    for (const file of files) {
      try {
        const raw = fs.readFileSync(file, "utf8");
        const rel = path.relative(cwd, file).replace(/\\/g, "/");
        all.push(...chunkMarkdown(rel, raw));
      } catch (err) {
        console.warn(`[KnowledgeBase] failed to read ${file}:`, err);
      }
    }
  }

  CACHE = all;
  CACHE_LOADED_AT = Date.now();
  return all;
}

/**
 * Token-overlap retriever — returns the top-K chunks whose token set has
 * the highest Jaccard-style overlap with the query. Good enough for a
 * <200-chunk corpus; trivially replaceable with embeddings later.
 */
export function retrieveContext(
  query: string,
  k: number = 5
): KnowledgeChunk[] {
  const chunks = loadKnowledgeBase();
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];

  const scored = chunks.map((c) => {
    let overlap = 0;
    for (const t of queryTokens) if (c.tokens.has(t)) overlap += 1;
    // Bonus for heading match — headings are dense semantic signals.
    const headingTokens = tokenize(c.heading);
    let headingOverlap = 0;
    for (const t of queryTokens) if (headingTokens.has(t)) headingOverlap += 1;
    const score = overlap + headingOverlap * 2;
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.c);
}

/**
 * Format retrieved chunks into a system-message context block. Each chunk
 * is delimited so the model can cite [doc:idx] inline.
 */
export function formatContextForPrompt(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map((c, i) => {
    return `[doc:${i + 1}] (${c.source})\n${c.content}`;
  });
  return blocks.join("\n\n---\n\n");
}
