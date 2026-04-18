import Link from "next/link";

export const metadata = {
  title: "Public sandbox API | E-Credentialing CVO Platform",
  description:
    "Hit the read-only sandbox API of the E-Credentialing CVO platform with synthetic data — no auth, no PHI, no signup. Perfect for proof-of-concept work.",
};

/**
 * Wave 5.2 — public sandbox documentation page.
 *
 * The actual sandbox endpoints live under /api/sandbox/v1/* and are
 * served by route handlers — they return deterministic synthetic
 * payloads so an evaluator can wire a POC without onboarding.
 */
export default function SandboxPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">E-Credentialing</Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/cvo" className="text-gray-700 hover:text-gray-900">Why CVO</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Public sandbox</p>
        <h1 className="mt-3 text-4xl font-extrabold text-gray-900 tracking-tight">
          Try the API without signing up
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          These endpoints return deterministic synthetic data. There's no
          rate-limit gate today (they're cheap), but please don't
          benchmark them — that's what <code className="font-mono text-sm">/api/v1/*</code> is for.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900">Endpoints</h2>
          <div className="mt-4 space-y-6">
            {endpoints.map((e) => (
              <article
                key={e.path}
                className="rounded-lg border border-gray-200 p-5"
              >
                <header className="flex flex-wrap items-baseline gap-3">
                  <span className="inline-flex px-2 py-0.5 rounded font-mono text-xs font-bold bg-green-100 text-green-800">
                    {e.method}
                  </span>
                  <code className="font-mono text-sm text-gray-900">{e.path}</code>
                  <span className="text-xs text-gray-500">{e.summary}</span>
                </header>
                <p className="mt-2 text-sm text-gray-700">{e.description}</p>
                <pre className="mt-3 overflow-x-auto rounded bg-gray-900 text-gray-100 p-3 text-xs">
                  <code>{e.example}</code>
                </pre>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl bg-gray-900 text-white p-8">
          <h2 className="text-xl font-bold">Quick start</h2>
          <p className="mt-2 text-gray-300">
            Pipe a sandbox provider straight into <code>jq</code>:
          </p>
          <pre className="mt-4 overflow-x-auto rounded bg-black p-4 text-xs">
            <code>{`# List sandbox providers
curl -s https://your-host/api/sandbox/v1/providers | jq

# Fetch one provider
curl -s https://your-host/api/sandbox/v1/providers/sandbox-1 | jq

# Pull the FHIR R4 metadata (CapabilityStatement)
curl -s https://your-host/api/sandbox/v1/fhir/metadata | jq '.rest[0].resource[].type'`}</code>
          </pre>
          <p className="mt-4 text-sm text-gray-400">
            Replace <code>your-host</code> with the URL where this app is deployed.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900">Limits + caveats</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>• All data is synthetic — never real PHI.</li>
            <li>• Read-only; POST/PUT/DELETE return <code>405</code>.</li>
            <li>• Schemas mirror but are not always identical to the production
              <code className="font-mono"> /api/v1/* </code> surfaces — see
              <code className="font-mono"> docs/dev/api-versioning.md </code>
              for the differences.</li>
            <li>• No SLA — the sandbox shares the production cluster and may
              be paused for short maintenance windows.</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} HDPulseAI · sandbox endpoints serve synthetic data only.
        </div>
      </footer>
    </div>
  );
}

const endpoints = [
  {
    method: "GET",
    path: "/api/sandbox/v1/providers",
    summary: "List sandbox providers (paginated)",
    description:
      "Returns ~25 deterministic synthetic providers with names, NPIs, license states, and current credentialing status. Add ?page=2 for the next batch.",
    example: `{
  "data": [
    { "id": "sandbox-1", "name": "Sarah Adler, MD",
      "npi": "1234567893", "primaryState": "NY",
      "status": "APPROVED" },
    { "id": "sandbox-2", "name": "Michael Brennan, DO",
      "npi": "1234567894", "primaryState": "PA",
      "status": "VERIFICATION_IN_PROGRESS" }
  ],
  "page": 1, "pageSize": 25, "total": 25
}`,
  },
  {
    method: "GET",
    path: "/api/sandbox/v1/providers/{id}",
    summary: "Get a single sandbox provider",
    description:
      "Returns the full provider envelope: identity, licenses, board certifications, sanctions check status, and the most recent expirables.",
    example: `{
  "id": "sandbox-1",
  "name": "Sarah Adler, MD",
  "npi": "1234567893",
  "licenses": [{"state":"NY","number":"NY-123456","expiresOn":"2027-02-28"}],
  "boards": [{"abmsBoard":"American Board of Internal Medicine","status":"CERTIFIED"}],
  "sanctions": {"oig":"clear","sam":"clear","stateMedicaid":"clear","lastChecked":"2026-04-15"},
  "expirables": [{"type":"DEA","expiresOn":"2026-08-31"}]
}`,
  },
  {
    method: "GET",
    path: "/api/sandbox/v1/fhir/metadata",
    summary: "FHIR R4 CapabilityStatement (sandbox)",
    description:
      "Same shape as the production /api/fhir/metadata endpoint, with sandbox versioning and base URL pre-set so you can point a FHIR client at it directly.",
    example: `{
  "resourceType": "CapabilityStatement",
  "fhirVersion": "4.0.1",
  "status": "active",
  "rest": [{
    "mode": "server",
    "resource": [
      { "type": "Practitioner",        "interaction": [{"code":"read"},{"code":"search-type"}] },
      { "type": "PractitionerRole",    "interaction": [{"code":"read"},{"code":"search-type"}] },
      { "type": "HealthcareService",   "interaction": [{"code":"read"},{"code":"search-type"}] },
      { "type": "InsurancePlan",       "interaction": [{"code":"read"},{"code":"search-type"}] }
    ]
  }]
}`,
  },
];
