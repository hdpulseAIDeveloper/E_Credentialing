/**
 * Wave 5.5 — server-only loader for the public changelog Markdown.
 *
 * Reads `docs/changelog/public.md` from the repo root and parses it.
 * Cached for the lifetime of the Next.js process (the file is part
 * of the deployed bundle, so it cannot change at runtime).
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseChangelog, type Release } from "./parser";

let cached: Release[] | null = null;

export async function loadPublicChangelog(): Promise<Release[]> {
  if (cached) return cached;
  const path = join(process.cwd(), "docs", "changelog", "public.md");
  const md = await readFile(path, "utf-8");
  cached = parseChangelog(md);
  return cached;
}

/** Test-only: bust the cache so a test can mutate the file on disk. */
export function __resetChangelogCacheForTests(): void {
  cached = null;
}
