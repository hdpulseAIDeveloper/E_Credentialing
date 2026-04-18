"use client";

/**
 * Wave 5.3 — client-side billing buttons.
 *
 * Server Actions would be cleaner, but the Stripe redirect requires a
 * full-page navigation off our origin, so we POST and follow the
 * returned `url`. Both endpoints are 503-safe when billing is disabled.
 */
import { useState } from "react";

interface BillingActionsProps {
  billingEnabled: boolean;
  hasCustomer: boolean;
}

export function BillingActions({ billingEnabled, hasCustomer }: BillingActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        setError(json.message ?? `Portal failed (${res.status}).`);
        return;
      }
      window.location.href = json.url;
    } finally {
      setLoading(null);
    }
  }

  if (!billingEnabled) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Billing actions become available once <code>BILLING_ENABLED=true</code>.
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={openPortal}
        disabled={loading === "portal" || !hasCustomer}
        className="inline-flex items-center px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
        data-testid="billing-open-portal"
      >
        {loading === "portal" ? "Opening…" : hasCustomer ? "Open billing portal" : "Start a checkout first"}
      </button>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function UpgradeForm({ planSlug }: { planSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !json.url) {
        setError(json.message ?? `Checkout failed (${res.status}).`);
        return;
      }
      window.location.href = json.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={checkout}
        disabled={loading}
        className="inline-flex w-full justify-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        data-testid={`billing-upgrade-${planSlug}`}
      >
        {loading ? "Redirecting…" : "Upgrade"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
