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

        <section className="mt-12 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">OpenAPI 3.1 spec</h2>
          <p className="mt-2 text-sm text-gray-700">
            The full machine-readable contract for{" "}
            <code className="font-mono">/api/v1/*</code> is published as
            an OpenAPI 3.1 document. Point Postman, Insomnia, or your
            generator at:
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-blue-200 p-3 text-xs">
            <code>{`# YAML (RFC 9512 source of truth)
curl -s https://your-host/api/v1/openapi.yaml | yq .

# JSON mirror — for tools that don't speak YAML
curl -s https://your-host/api/v1/openapi.json | jq .`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            Source of truth lives at{" "}
            <code className="font-mono">docs/api/openapi-v1.yaml</code>{" "}
            in the repository. The JSON document at{" "}
            <code className="font-mono">/api/v1/openapi.json</code> is a
            mechanical 1:1 conversion. Versioned with the platform; changes
            are announced in the public{" "}
            <Link href="/changelog" className="underline text-blue-700">changelog</Link>.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">TypeScript SDK</h2>
          <p className="mt-2 text-sm text-gray-700">
            A dependency-free TypeScript client lives in the repository at{" "}
            <code className="font-mono">src/lib/api-client/v1.ts</code> with
            spec-derived types at{" "}
            <code className="font-mono">src/lib/api-client/v1-types.ts</code>.
            Drop both files into any Node 18+ project (no transitive deps):
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-emerald-200 p-3 text-xs">
            <code>{`import { V1Client } from "./api-client/v1";

const client = new V1Client({
  baseUrl: "https://your-host",
  apiKey: process.env.ECRED_API_KEY!,
});

const { data, pagination } = await client.listProviders({
  status: "APPROVED",
  page: 1,
  limit: 25,
});`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            Python customers: see{" "}
            <code className="font-mono">docs/dev/runbooks/sdk-generation.md</code>{" "}
            for the canonical <code>openapi-python-client</code> flow against the
            same OpenAPI spec.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Postman / Insomnia / Bruno collection
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            One-click import — every documented endpoint pre-wired with
            Bearer auth and a <code className="font-mono">{`{{base_url}}`}</code>{" "}
            variable so you point one field at your environment:
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-amber-200 p-3 text-xs">
            <code>{`# Download the Postman v2.1 collection
curl -L https://your-host/api/v1/postman.json \\
  -o ecredentialing-v1.postman_collection.json

# In Postman: File -> Import -> select the file
# Then set the {{api_key}} environment variable to your key.`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            The collection is regenerated from{" "}
            <code className="font-mono">docs/api/openapi-v1.yaml</code> on
            every CI run; a contract test (Pillar J) fails the build if the
            spec adds an endpoint that the collection doesn't cover.
          </p>
          <p className="mt-3 text-xs text-gray-600">
            Versioning + deprecation policy:{" "}
            <code className="font-mono">docs/api/versioning.md</code> is the
            canonical contract. Active deprecations always surface as{" "}
            <code className="font-mono">Deprecation</code>,{" "}
            <code className="font-mono">Sunset</code>, and{" "}
            <code className="font-mono">Link: rel=&quot;successor-version&quot;</code> response
            headers (RFC 9745 / 8594 / 8288).
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Pagination Link headers (RFC 8288)
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Every paginated list endpoint (
            <code className="font-mono">/providers</code>,{" "}
            <code className="font-mono">/sanctions</code>,{" "}
            <code className="font-mono">/enrollments</code>) returns a{" "}
            <code className="font-mono">Link</code> response header with{" "}
            <code className="font-mono">first</code>,{" "}
            <code className="font-mono">prev</code>,{" "}
            <code className="font-mono">next</code>, and{" "}
            <code className="font-mono">last</code> URLs (since spec{" "}
            <code className="font-mono">1.5.0</code>). Filters and{" "}
            <code className="font-mono">limit</code> are preserved in every
            link target so you don't have to re-build the query string.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-amber-200 p-3 text-xs">
            <code>{`curl -i "https://your-host/api/v1/providers?page=2&limit=25" \\
  -H "Authorization: Bearer $ECRED_API_KEY"

# Link: <https://your-host/api/v1/providers?page=1&limit=25>; rel="first",
#       <https://your-host/api/v1/providers?page=1&limit=25>; rel="prev",
#       <https://your-host/api/v1/providers?page=3&limit=25>; rel="next",
#       <https://your-host/api/v1/providers?page=4&limit=25>; rel="last"`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            TypeScript SDK:{" "}
            <code className="font-mono">parseLinkHeader(response.headers.get("Link"))</code>{" "}
            returns a typed{" "}
            <code className="font-mono">{`{ first?, prev?, next?, last? }`}</code>{" "}
            map. Empty result sets emit no{" "}
            <code className="font-mono">Link</code> header.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-cyan-200 bg-cyan-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            API key introspection (GET /api/v1/me)
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Pairs with <code className="font-mono">/health</code> to make
            "is my key configured correctly?" a one-call answer. Returns
            the key's name, granted scopes, lifecycle timestamps, and
            current rate-limit budget — never the bearer key itself.
            Available since spec <code className="font-mono">1.4.0</code>;
            requires any active bearer key but no specific scope.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-cyan-200 p-3 text-xs">
            <code>{`curl -s https://your-host/api/v1/me \\
  -H "Authorization: Bearer $ECRED_API_KEY" | jq .

# {
#   "keyId": "ck_test_abc",
#   "name": "Production prod-east",
#   "scopes": ["providers:read", "sanctions:read"],
#   "createdAt": "2026-01-15T10:30:00.000Z",
#   "expiresAt": "2027-01-15T10:30:00.000Z",
#   "lastUsedAt": "2026-04-18T22:14:33.123Z",
#   "rateLimit": { "limit": 120, "remaining": 117,
#                  "resetUnixSeconds": 1739887200 }
# }`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            TypeScript SDK: <code className="font-mono">await client.me()</code>{" "}
            returns the same shape, fully typed off{" "}
            <code className="font-mono">components.schemas.Me</code>.
          </p>
        </section>

        <section className="mt-12 rounded-xl border border-purple-200 bg-purple-50 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Request correlation (X-Request-Id)
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            Every <code className="font-mono">/api/v1/*</code> request and
            response carries an <code className="font-mono">X-Request-Id</code>{" "}
            header (since spec <code className="font-mono">1.3.0</code>). Send
            your own correlation id and we'll honour it; otherwise we generate
            an opaque <code className="font-mono">req_&lt;hex&gt;</code>. Either
            way, the value is the lookup key in our audit log + structured logs
            — paste it into a support ticket and on-call can pull both halves
            of the trace.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-white border border-purple-200 p-3 text-xs">
            <code>{`curl -i https://your-host/api/v1/health \\
  -H "Authorization: Bearer $ECRED_API_KEY" \\
  -H "X-Request-Id: req_my_client_correlation_id"

# Response includes the same X-Request-Id back in the headers,
# whether the call succeeded or failed.`}</code>
          </pre>
          <p className="mt-3 text-xs text-gray-600">
            The TypeScript SDK accepts a{" "}
            <code className="font-mono">requestIdFactory</code> option and
            exposes the server-assigned id on{" "}
            <code className="font-mono">V1ApiError.requestId</code>. Format gate:{" "}
            <code className="font-mono">^[A-Za-z0-9_\-]&#123;8,128&#125;$</code>{" "}
            — covers ULID, UUIDv4, Stripe-style{" "}
            <code className="font-mono">req_*</code>, and any opaque token.
          </p>
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
