import Link from "next/link";
import { listCatalogEntries } from "@/lib/api/error-catalog";

export const metadata = {
  title: "Error catalog | E-Credentialing CVO Platform",
  description:
    "Every error code the v1 API can return, with stable HTTP status, machine-readable identifier, and concrete remediation guidance. The canonical resolver for every Problem `type` URI in the platform.",
};

/**
 * Wave 21 — public HTML index for the v1 error catalog.
 *
 * This is the URL that every Problem body's `type` URI ultimately
 * points to (`<base>/errors`). The detail page at
 * `/errors/[code]` is what individual `type` URIs resolve to —
 * see the comment block on `src/lib/api/error-catalog.ts` for the
 * single-source-of-truth contract.
 */
export default function ErrorCatalogPage() {
  const entries = listCatalogEntries();

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
            <Link href="/sandbox" className="text-gray-700 hover:text-gray-900">
              Sandbox
            </Link>
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">
              Pricing
            </Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          Public REST v1 — error catalog
        </p>
        <h1 className="mt-3 text-4xl font-extrabold text-gray-900 tracking-tight">
          Every error code, in one place
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          When a v1 endpoint returns an{" "}
          <a
            href="https://datatracker.ietf.org/doc/html/rfc9457"
            className="text-blue-600 underline"
          >
            RFC 9457 Problem
          </a>{" "}
          body, its <code className="font-mono">type</code> field is a
          stable URI that lives <em>here</em> — under{" "}
          <code className="font-mono">/errors/&lt;kebab-code&gt;</code>.
          Click any code to see the canonical English description plus
          concrete remediation guidance.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          The same data is available as JSON at{" "}
          <code className="font-mono">/api/v1/errors</code> (list) and{" "}
          <code className="font-mono">/api/v1/errors/&#123;code&#125;</code>{" "}
          (single entry) for SDK and tooling consumption. Both endpoints
          require any valid API key, support conditional GETs (ETag),
          and emit the same rate-limit / request-id / deprecation
          headers as every other v1 surface.
        </p>

        <div className="mt-10 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.code} className="hover:bg-blue-50">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={entry.docsPath}
                      className="font-mono text-sm text-blue-700 underline"
                    >
                      {entry.code}
                    </Link>
                    {entry.retiredInVersion ? (
                      <span className="ml-2 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-700">
                        retired {entry.retiredInVersion}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-gray-700">
                    {entry.status}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-gray-900">
                    {entry.title}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-gray-700">
                    {entry.summary}
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-gray-600">
                    v{entry.sinceVersion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-12 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            How to use this catalog
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-gray-700">
            <li>
              <strong>From a human:</strong> click any code above, or
              navigate to <code className="font-mono">/errors/&lt;kebab-code&gt;</code>{" "}
              directly. The detail page is the canonical resolver of
              every <code className="font-mono">type</code> URI in
              every Problem body the platform emits.
            </li>
            <li>
              <strong>From the TypeScript SDK:</strong> after a thrown
              <code className="font-mono">V1ApiError</code>, dispatch
              on <code className="font-mono">err.problem?.type</code>{" "}
              (a stable URI) instead of parsing the English message.
              For validation failures, use the{" "}
              <code className="font-mono">isValidationProblem</code>{" "}
              type guard to narrow{" "}
              <code className="font-mono">err.problem.errors[]</code>.
            </li>
            <li>
              <strong>From any HTTP client:</strong> hit{" "}
              <code className="font-mono">GET /api/v1/errors</code>{" "}
              with any active API key. The response is sorted by{" "}
              <code className="font-mono">code</code> ascending, has a
              stable <code className="font-mono">ETag</code>, and is
              safe to cache aggressively across requests — the catalog
              only changes when the platform ships a new release.
            </li>
            <li>
              <strong>From Postman:</strong> the regenerated collection
              at <code className="font-mono">/api/v1/postman.json</code>{" "}
              ships with both <code className="font-mono">/errors</code>{" "}
              endpoints pre-wired.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
