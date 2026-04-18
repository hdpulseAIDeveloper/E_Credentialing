import Link from "next/link";

export const metadata = {
  title: "Pricing | E-Credentialing CVO Platform",
  description:
    "Transparent monthly pricing for the E-Credentialing CVO platform — Starter, Growth, and Enterprise tiers, all NCQA-aligned.",
};

/**
 * Wave 5.2 — public pricing page. Numbers here are scaffolding only;
 * the live values land in Wave 5.3 once Stripe Billing is wired in
 * behind BILLING_ENABLED.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">E-Credentialing</Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/cvo" className="text-gray-700 hover:text-gray-900">Why CVO</Link>
            <Link href="/sandbox" className="text-gray-700 hover:text-gray-900">Sandbox</Link>
            <Link href="/auth/signin" className="text-blue-600 font-semibold">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Pricing</p>
          <h1 className="mt-3 text-4xl font-extrabold text-gray-900 tracking-tight">
            Pay for files credentialed, not files filed
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Three tiers. Same audit chain, same FHIR directory, same bot fleet.
            Annual contracts; cancel any time before renewal.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl bg-white p-6 shadow-sm border ${t.featured ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}`}
            >
              {t.featured && (
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">Most popular</p>
              )}
              <h2 className="text-xl font-bold text-gray-900">{t.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{t.tagline}</p>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-gray-900">{t.price}</span>
                {t.priceSuffix && <span className="text-sm text-gray-500"> {t.priceSuffix}</span>}
              </div>
              <p className="mt-2 text-xs text-gray-500">{t.priceFootnote}</p>

              <ul className="mt-6 space-y-3 text-sm text-gray-700">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={t.cta.href}
                className={`mt-8 block text-center px-4 py-3 rounded-lg font-semibold ${t.featured ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-900 text-white hover:bg-gray-800"}`}
              >
                {t.cta.label}
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-16 bg-white border border-gray-200 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900">Frequently asked</h2>
          <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-sm text-gray-700">
            {faq.map((q) => (
              <div key={q.q}>
                <dt className="font-semibold text-gray-900">{q.q}</dt>
                <dd className="mt-1 text-gray-600">{q.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} HDPulseAI · pricing tiers are
          indicative; live values come from Stripe at checkout when
          BILLING_ENABLED is on.
        </div>
      </footer>
    </div>
  );
}

const tiers = [
  {
    name: "Starter",
    tagline: "For independent groups < 50 providers.",
    price: "$1,495",
    priceSuffix: "/ mo",
    priceFootnote: "Up to 50 active providers. $30 / file overage.",
    features: [
      "Full PSV bot fleet (state board, DEA, ABMS, NPDB, OIG)",
      "FHIR R4 public directory + payer roster automation",
      "Tamper-evident audit log (HMAC-chained)",
      "Email support, 1-business-day SLA",
    ],
    cta: { href: "/auth/register", label: "Start your trial" },
    featured: false,
  },
  {
    name: "Growth",
    tagline: "Mid-size groups, IPAs, and MSOs (50–500 providers).",
    price: "$4,995",
    priceSuffix: "/ mo",
    priceFootnote: "Up to 500 active providers. $20 / file overage.",
    features: [
      "Everything in Starter, plus:",
      "OPPE / FPPE quarterly scorecards + peer review",
      "TJC NPG-12 evidence chain",
      "FSMB PDC continuous monitoring subscription",
      "Slack + email support, 4-business-hour SLA",
    ],
    cta: { href: "/auth/register?plan=growth", label: "Talk to sales" },
    featured: true,
  },
  {
    name: "Enterprise",
    tagline: "Health systems + regional CVO buyers.",
    price: "Custom",
    priceSuffix: "",
    priceFootnote: "Volume discount + multi-org support + SOC 2 audit pack.",
    features: [
      "Everything in Growth, plus:",
      "Multi-tenant org switching (ADR 0014 shim)",
      "SOC 2 Type I auditor packet (Wave 5.4)",
      "Dedicated success manager + 99.9% uptime SLA",
      "Private Azure tenant + customer-managed Key Vault",
    ],
    cta: { href: "mailto:sales@hdpulseai.com", label: "Contact sales" },
    featured: false,
  },
];

const faq = [
  {
    q: "What counts as an active provider?",
    a: "A provider with status APPROVED or COMMITTEE_IN_REVIEW within the billing month. Inactive / terminated providers do not count.",
  },
  {
    q: "Do you charge for the FHIR directory?",
    a: "No. The public CMS-0057-F endpoints are included on every tier — they're a regulatory requirement, not an upsell.",
  },
  {
    q: "Can we self-host?",
    a: "Yes — Enterprise plans ship with the full Bicep IaC stack (`infra/main.bicep`) and an `azd up` recipe so you can deploy into your own Azure tenant.",
  },
  {
    q: "What about HIPAA BAAs?",
    a: "HDPulseAI executes a BAA with every customer at any tier. The Enterprise tier additionally allows customer-managed Key Vault rotation.",
  },
];
