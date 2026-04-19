import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findCatalogEntry,
  listCatalogEntries,
} from "@/lib/api/error-catalog";

interface ErrorDetailPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Wave 21 — public HTML detail page for a single error code.
 *
 * This page is the canonical resolver of every `type` URI inside
 * every Problem body the platform emits. The kebab-case suffix
 * of `type` (e.g. `…/errors/insufficient-scope`) maps directly
 * to this route's `[code]` parameter.
 *
 * Both kebab-case and snake_case forms are accepted so callers
 * can either chop the URI suffix verbatim or use the same
 * snake_case identifier as the JSON `error.code` field.
 */
export async function generateMetadata({ params }: ErrorDetailPageProps) {
  const { code } = await params;
  const normalised = code.replace(/-/g, "_").toLowerCase();
  const entry = findCatalogEntry(normalised);
  if (!entry) {
    return {
      title: "Unknown error code | E-Credentialing CVO Platform",
      description:
        "This error code is not in the v1 catalog. It may belong to a future release or be a typo.",
    };
  }
  return {
    title: `${entry.title} (${entry.code}) | E-Credentialing CVO Platform`,
    description: entry.summary,
  };
}

/**
 * Pre-render the detail pages at build time so the URLs that the
 * Problem body's `type` field points to are statically available
 * (no cold-start latency, no DB hit, no auth gate).
 */
export function generateStaticParams() {
  const entries = listCatalogEntries();
  // Emit both kebab and snake forms so both URL shapes hit a
  // pre-rendered page rather than falling through to dynamic
  // rendering. The snake form is what `/api/v1/errors/{code}`
  // also accepts, so the two surfaces stay symmetrical.
  return entries.flatMap((entry) => [
    { code: entry.code.replace(/_/g, "-").toLowerCase() },
    { code: entry.code },
  ]);
}

export default async function ErrorDetailPage({ params }: ErrorDetailPageProps) {
  const { code } = await params;
  const normalised = code.replace(/-/g, "_").toLowerCase();
  const entry = findCatalogEntry(normalised);

  if (!entry) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            E-Credentialing
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/cvo" className="text-gray-700 hover:text-gray-900">
              Why CVO
            </Link>
            <Link href="/errors" className="text-gray-700 hover:text-gray-900">
              All errors
            </Link>
            <Link href="/sandbox" className="text-gray-700 hover:text-gray-900">
              Sandbox
            </Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-sm">
          <Link href="/errors" className="text-blue-600 underline">
            &larr; Back to error catalog
          </Link>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              entry.status >= 500
                ? "bg-red-100 text-red-800"
                : entry.status >= 400
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}
          >
            HTTP {entry.status}
          </span>
          <code className="font-mono text-sm text-gray-700">{entry.code}</code>
          <span className="font-mono text-xs text-gray-500">
            since v{entry.sinceVersion}
          </span>
          {entry.retiredInVersion ? (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
              retired in v{entry.retiredInVersion}
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 text-4xl font-extrabold text-gray-900 tracking-tight">
          {entry.title}
        </h1>
        <p className="mt-4 text-lg text-gray-700">{entry.summary}</p>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">What it means</h2>
          <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-800">
            {entry.description}
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">How to fix it</h2>
          {entry.remediation ? (
            <p className="mt-3 whitespace-pre-line text-base leading-7 text-gray-800">
              {entry.remediation}
            </p>
          ) : (
            <p className="mt-3 text-base leading-7 text-gray-700">
              This is a transient server-side condition. Retry with
              exponential backoff (recommended: 1s, 2s, 4s, 8s,
              capped at 30s, with jitter). If it persists for more
              than 5 minutes, file a support ticket quoting the
              <code className="font-mono"> X-Request-Id </code>
              from any failed response.
            </p>
          )}
        </section>

        <section className="mt-10 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Wire-format reference
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            When this error is emitted, the response body looks like
            this. The <code className="font-mono">type</code> field is
            the URL of <em>this</em> page; the legacy{" "}
            <code className="font-mono">{`{ error: { code, message } }`}</code>{" "}
            envelope is preserved for backward-compatible clients.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-gray-200 p-3 text-xs">
            <code>{`HTTP/1.1 ${entry.status} ${entry.title}
Content-Type: application/problem+json
{
  "type": "<base>${entry.docsPath}",
  "title": "${entry.title.replace(/"/g, '\\"')}",
  "status": ${entry.status},
  "detail": "<occurrence-specific message>",
  "instance": "<request path>",
  "error": {
    "code": "${entry.code}",
    "message": "<occurrence-specific message>"
  }
}`}</code>
          </pre>
        </section>

        <section className="mt-10 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Programmatic access
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            The same data is at{" "}
            <code className="font-mono">
              GET /api/v1/errors/{entry.code}
            </code>{" "}
            (kebab-case is also accepted) for SDK / tooling
            consumption.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-blue-200 p-3 text-xs">
            <code>{`curl -i https://your-host/api/v1/errors/${entry.code} \\
  -H "Authorization: Bearer $ECRED_API_KEY"`}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}
