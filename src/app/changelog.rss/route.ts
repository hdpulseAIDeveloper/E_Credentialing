/**
 * Wave 5.5 — RSS feed for the public changelog at /changelog.rss.
 *
 * Rendered fresh on each request because the source file is part of
 * the deployment and only changes between releases.
 */
import { NextResponse } from "next/server";
import { env } from "@/env";
import { loadPublicChangelog } from "@/lib/changelog/loader";
import { renderChangelogRss } from "@/lib/changelog/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const releases = await loadPublicChangelog();
  const url = new URL(request.url);
  const baseUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? url.origin;
  const xml = renderChangelogRss(releases, { baseUrl });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
