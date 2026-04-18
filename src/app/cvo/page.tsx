import Link from "next/link";

export const metadata = {
  title: "What is a CVO? | E-Credentialing",
  description:
    "A Credentialing Verification Organization (CVO) automates primary-source verification, ongoing monitoring, recredentialing, and payer enrollment. Here is how the E-Credentialing CVO platform compares to building it in-house.",
};

/**
 * Wave 5.2 — public CVO explainer page.
 *
 * Read-only, no auth, no PHI. Structure:
 *   1. What a CVO is (definition + scope)
 *   2. What we automate (NCQA element-by-element grid)
 *   3. How we compare (in-house vs. legacy CVO vs. us)
 *   4. CTA back to /pricing + /sandbox
 */
export default function CvoPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            E-Credentialing
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
            <Link href="/sandbox" className="text-gray-700 hover:text-gray-900">Sandbox</Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Product overview</p>
        <h1 className="mt-3 text-4xl font-extrabold text-gray-900 tracking-tight">
          What is a Credentialing Verification Organization?
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          A CVO does the unglamorous, audit-critical work of proving that
          every clinician on your roster is legitimately licensed,
          unsanctioned, board-eligible, insured, and currently practicing
          within scope. NCQA, The Joint Commission, and CMS all require it,
          and getting it wrong is how a malpractice claim becomes a
          corporate-negligence claim.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">What we automate, by NCQA element</h2>
          <p className="mt-2 text-gray-600">
            NCQA CR-3 spells out exactly what must be primary-source verified
            and on what cadence. Every row below is a workflow we ship.
          </p>
          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">NCQA element</th>
                  <th className="px-4 py-3 font-semibold">Our automation</th>
                  <th className="px-4 py-3 font-semibold">Cadence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ncqaElements.map((row) => (
                  <tr key={row.element} className="bg-white">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.element}</td>
                    <td className="px-4 py-3 text-gray-700">{row.automation}</td>
                    <td className="px-4 py-3 text-gray-500">{row.cadence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">How we compare</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparison.map((c) => (
              <div
                key={c.title}
                className={`rounded-lg border p-5 ${c.us ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
              >
                <h3 className="font-semibold text-gray-900">{c.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span aria-hidden="true" className="text-blue-600">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900">Beyond NCQA</h2>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>
              <strong>The Joint Commission NPG-12 evidence chain</strong> —
              quarterly OPPE scorecards, FPPE triggers, peer-review
              minutes, and the audit pack a surveyor wants to see.
            </li>
            <li>
              <strong>CMS-0057-F FHIR R4 directory</strong> — public
              Practitioner / PractitionerRole / HealthcareService /
              InsurancePlan / Endpoint endpoints with `$everything`,
              SearchParameter, and CapabilityStatement.
            </li>
            <li>
              <strong>Telehealth & IMLC tracking</strong> — per-platform
              certifications, IMLC Letters of Qualification, and the 7-state
              concurrent-license rule, all surfaced on the same Expirables
              board your team already uses.
            </li>
            <li>
              <strong>Multi-tenancy from day one</strong> — every PHI row
              is row-scoped to an organization (ADR 0014) so you can spin
              up a sister IPA on the same instance without forking.
            </li>
          </ul>
        </section>

        <section className="mt-12 rounded-xl bg-blue-600 text-white p-8 text-center">
          <h2 className="text-2xl font-bold">Try it before you buy it</h2>
          <p className="mt-2 text-blue-100">
            Hit the read-only sandbox API with synthetic data — no auth, no
            PHI, no signup. Two REST endpoints + the FHIR `metadata`
            endpoint return realistic responses you can wire into a
            proof-of-concept in an afternoon.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sandbox"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold bg-white text-blue-700 rounded-lg hover:bg-blue-50"
            >
              Open the sandbox
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold bg-blue-700 text-white border border-blue-400 rounded-lg hover:bg-blue-800"
            >
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} HDPulseAI · E-Credentialing CVO Platform.
        </div>
      </footer>
    </div>
  );
}

const ncqaElements = [
  { element: "State medical license", automation: "State board scrapers + FSMB PDC subscription", cadence: "Daily delta sync" },
  { element: "DEA registration", automation: "DEA Diversion Control headless lookup", cadence: "Monthly + on-demand" },
  { element: "Board certification", automation: "ABMS, AOA, and specialty-board scrapers", cadence: "Recredentialing + 3-year delta" },
  { element: "Education + training", automation: "AAMC/ECFMG verification + AMA Profiles cross-check", cadence: "Initial credentialing only" },
  { element: "Work history (5 yr)", automation: "Magic-link reference flow + employment-gap workflow", cadence: "Initial + recred" },
  { element: "Malpractice history", automation: "NPDB Continuous Query enrolment + verdict ingest", cadence: "Continuous" },
  { element: "Sanctions (OIG, SAM, state Medicaid)", automation: "OIG LEIE + SAM EPLS + 50-state Medicaid scrapers", cadence: "Monthly + on-demand" },
  { element: "Hospital privileges", automation: "Letter ingest + PSV via hospital MSO", cadence: "Recredentialing" },
  { element: "Liability insurance", automation: "Carrier magic-link + COI parser", cadence: "Pre-expiry alert" },
  { element: "Attestation", automation: "Provider self-attestation form + e-sign", cadence: "Initial + recred" },
];

const comparison = [
  {
    title: "Build it in-house",
    us: false,
    bullets: [
      "12-18 months to a working v1",
      "FTE in perpetuity to maintain bot scrapers",
      "DIY tamper-evident audit log",
      "Roll your own NCQA + TJC mapping",
    ],
  },
  {
    title: "E-Credentialing CVO",
    us: true,
    bullets: [
      "Day-one NCQA + TJC + CMS-0057-F coverage",
      "Bot fleet + audit chain + FHIR directory included",
      "Multi-tenant shim from day one",
      "Sandbox API + Bicep IaC for fast spin-up",
    ],
  },
  {
    title: "Legacy CVO outsource",
    us: false,
    bullets: [
      "Per-file pricing (~$200-$500 / file)",
      "Email + spreadsheet workflows",
      "No native FHIR directory",
      "Months of lead time, no API",
    ],
  },
];
