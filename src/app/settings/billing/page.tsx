/**
 * Wave 5.3 — in-app billing settings page.
 *
 * Server Component that reads the org's billing state and renders:
 *   - Current plan
 *   - Subscription status + dunning banner (if past_due / incomplete)
 *   - "Open billing portal" button (Stripe-hosted)
 *   - Plan list with "Upgrade" buttons
 *
 * When BILLING_ENABLED is false, the page degrades gracefully to an
 * informational state instead of throwing.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/env";
import { listActivePlans, PLANS } from "@/lib/billing/plans";
import {
  isEntitled,
  isLocked,
  shouldShowDunningBanner,
} from "@/lib/billing/subscription-state";
import { BillingActions, UpgradeForm } from "./billing-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing | E-Credentialing CVO Platform",
};

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings/billing");

  const orgId = (session.user as { organizationId?: string }).organizationId ?? "org_essen";
  const org = await db.organization.findUnique({ where: { id: orgId } });

  const billingEnabled = env.BILLING_ENABLED;
  const currentPlan = org?.plan ?? "starter";
  const planDef = PLANS[currentPlan as keyof typeof PLANS] ?? PLANS.starter;
  const status = org?.billingStatus ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        <p className="mt-1 text-gray-600">
          Manage your plan, payment method, and invoices.
        </p>
      </header>

      {searchParams.status === "success" && (
        <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Subscription updated. Stripe will email you a receipt shortly.
        </div>
      )}

      {!billingEnabled && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Billing is disabled on this deployment.</strong>
          <span className="ml-1">
            Set <code className="font-mono">BILLING_ENABLED=true</code> and the
            Stripe env vars to enable checkout.
          </span>
        </div>
      )}

      {billingEnabled && shouldShowDunningBanner(status) && (
        <div
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          data-testid="billing-dunning-banner"
        >
          We had trouble charging your card (status: <code>{status}</code>).
          Please update your payment method to avoid service interruption.
        </div>
      )}

      {billingEnabled && isLocked(status) && (
        <div
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          data-testid="billing-locked-banner"
        >
          Your subscription is <code>{status}</code>. Service is currently
          locked. Open the billing portal to restore access.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {planDef.displayName}
            </p>
            <p className="mt-1 text-sm text-gray-600">{planDef.tagline}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            {status && (
              <p>
                Status: <span className="font-semibold">{status}</span>
                {isEntitled(status) && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                    active
                  </span>
                )}
              </p>
            )}
            {org?.billingCurrentPeriodEnd && (
              <p>Renews on {new Date(org.billingCurrentPeriodEnd).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <BillingActions
          billingEnabled={billingEnabled}
          hasCustomer={Boolean(org?.billingCustomerId)}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-gray-900">Available plans</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {listActivePlans().map((p) => {
            const isCurrent = p.slug === currentPlan;
            return (
              <article
                key={p.slug}
                className={`rounded-xl border p-5 ${
                  isCurrent ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                }`}
                data-testid={`billing-plan-card-${p.slug}`}
              >
                <h3 className="text-lg font-bold text-gray-900">{p.displayName}</h3>
                <p className="mt-1 text-sm text-gray-600">{p.tagline}</p>
                <p className="mt-3 text-2xl font-extrabold text-gray-900">
                  {p.indicativePriceCents > 0
                    ? `$${(p.indicativePriceCents / 100).toLocaleString()}`
                    : "Contact"}
                  <span className="text-sm font-normal text-gray-500"> / {p.priceUnit}</span>
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {p.features.slice(0, 4).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <p className="mt-4 text-xs font-semibold text-blue-700">
                    Your current plan
                  </p>
                ) : billingEnabled ? (
                  <UpgradeForm planSlug={p.slug} />
                ) : (
                  <Link
                    href="/pricing"
                    className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700"
                  >
                    See pricing →
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
