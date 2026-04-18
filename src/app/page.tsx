import Link from "next/link";
import { auth } from "@/server/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

/**
 * Wave 5.2 — public marketing landing for the E-Credentialing CVO
 * platform. CVO ("Credentialing Verification Organization") positioning
 * is now the primary headline; the provider self-service entry point is
 * preserved as a secondary CTA so existing providers landing here from
 * an invite email still find their flow in one click.
 *
 * Sub-pages:
 *   - /cvo       → product explainer (what we automate, NCQA / TJC fit)
 *   - /pricing   → tier table (Starter / Growth / Enterprise)
 *   - /sandbox   → public API sandbox (read-only, synthetic data)
 *
 * Anti-weakening (STANDARD.md §4.2):
 *   - DO NOT paywall /cvo or /sandbox behind auth — both are critical
 *     to the sales motion and are visual-baseline-locked in pillar F.
 *   - DO NOT load PHI on this page; visual baselines run anonymously.
 */
export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">
                E-Credentialing
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider bg-blue-100 text-blue-700 rounded">
                CVO Platform
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/cvo"
                className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Why CVO
              </Link>
              <Link
                href="/pricing"
                className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/sandbox"
                className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                API Sandbox
              </Link>
              <Link
                href="/changelog"
                className="hidden sm:inline-block px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Changelog
              </Link>
              {session?.user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <SignOutButton />
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          NCQA-aligned · TJC NPG-12 ready · CMS-0057-F FHIR R4
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
          The full-stack{" "}
          <span className="text-blue-600">CVO platform</span>
          <br className="hidden sm:block" />
          for modern medical groups
        </h1>

        <p className="max-w-3xl mx-auto text-lg text-gray-600 mb-10">
          Primary-source verification, OPPE/FPPE cycles, payer enrollment,
          recredentialing, and a public FHIR R4 provider directory — automated
          end-to-end and audit-ready out of the box.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/cvo"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            See how it works
          </Link>
          <Link
            href="/sandbox"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Try the sandbox API
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Already a provider on this platform?{" "}
          <Link href="/auth/register" className="text-blue-600 hover:underline">
            Start your application
          </Link>{" "}
          or{" "}
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            sign in
          </Link>
          .
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { stat: "100%", label: "NCQA file elements covered" },
            { stat: "<48 h", label: "Median PSV turnaround" },
            { stat: "FHIR R4", label: "Public directory built-in" },
            { stat: "SOC 2", label: "Type I gap analysis ready" },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-3xl font-bold text-blue-600">{m.stat}</div>
              <div className="mt-1 text-sm text-gray-600">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} HDPulseAI · E-Credentialing CVO Platform.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/legal/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/legal/hipaa" className="hover:text-gray-700">HIPAA</Link>
            <Link href="/legal/cookies" className="hover:text-gray-700">Cookies</Link>
            <Link href="/changelog" className="hover:text-gray-700">Changelog</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: "Primary-source verification, automated",
    description:
      "Headless Playwright bots scrape state boards, DEA, ABMS, NPDB, OIG, SAM, and 50-state Medicaid sanctions on a schedule — every result captured as a tamper-evident audit row.",
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "OPPE / FPPE & TJC NPG-12 built-in",
    description:
      "Quarterly OPPE scorecards, FPPE triggers, peer-review minutes, and Joint Commission NPG-12 evidence chains — all generated from the data you already have.",
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "FHIR R4 public directory + payer roster automation",
    description:
      "Plan-Net Practitioner / HealthcareService / InsurancePlan endpoints and per-payer SFTP roster generators — CMS-0057-F ready on day one.",
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];
