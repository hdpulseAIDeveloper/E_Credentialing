/**
 * Staff: Behavioral health roster — P3 Gap #22.
 *
 * Surfaces:
 *   • How many providers are flagged behavioral health
 *   • Who is provisionally licensed (and whether their attestation is current)
 *   • Upcoming provisional-license expirations
 *   • BCBS fast-track candidates and submitted-state
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function BehavioralHealthPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const profiles = await db.providerProfile.findMany({
    where: { isBehavioralHealth: true },
    include: {
      provider: {
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          npi: true,
          status: true,
          supervisionAttestations: {
            where: { status: "ACCEPTED" },
            orderBy: { periodEnd: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ isProvisionallyLicensed: "desc" }, { updatedAt: "desc" }],
  });

  const provisional = profiles.filter((p) => p.isProvisionallyLicensed);
  const expiringLicense = provisional.filter(
    (p) =>
      p.provisionalLicenseExpires &&
      p.provisionalLicenseExpires <= in60 &&
      p.provisionalLicenseExpires > now
  );
  const missingAttestation = provisional.filter((p) => {
    const latest = p.provider.supervisionAttestations[0];
    return !latest || latest.periodEnd < now;
  });
  const bcbsSubmitted = profiles.filter((p) => p.bcbsFastTrackSubmittedAt);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Behavioral health roster
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          NUCC-tagged behavioral health clinicians, supervision attestations
          for provisional licensees, and BCBS fast-track tracking.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Stat label="Behavioral health providers" value={profiles.length} color="text-indigo-700" />
        <Stat label="Provisionally licensed" value={provisional.length} color="text-amber-700" />
        <Stat
          label="Provisional license <60d"
          value={expiringLicense.length}
          color={expiringLicense.length > 0 ? "text-red-700" : "text-gray-600"}
        />
        <Stat
          label="Missing/expired attestation"
          value={missingAttestation.length}
          color={missingAttestation.length > 0 ? "text-red-700" : "text-gray-600"}
        />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            BH roster ({profiles.length})
          </h2>
          <span className="text-xs text-gray-500">
            BCBS fast-track submitted: {bcbsSubmitted.length}
          </span>
        </header>
        {profiles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No providers flagged as behavioral health yet. Tag a NUCC taxonomy
            on the provider profile to populate this list.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">NPI</th>
                <th className="px-4 py-2 text-left">Taxonomy</th>
                <th className="px-4 py-2 text-left">Provisional</th>
                <th className="px-4 py-2 text-left">Latest attestation</th>
                <th className="px-4 py-2 text-left">BCBS fast-track</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((p) => {
                const latest = p.provider.supervisionAttestations[0];
                const stale = !latest || latest.periodEnd < now;
                return (
                  <tr key={p.providerId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs">
                      <Link
                        href={`/providers/${p.provider.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {p.provider.legalLastName}, {p.provider.legalFirstName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {p.provider.npi ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {p.nuccTaxonomyPrimary ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p.isProvisionallyLicensed ? (
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            p.provisionalLicenseExpires &&
                            p.provisionalLicenseExpires <= in60
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Yes
                          {p.provisionalLicenseExpires
                            ? ` (exp ${p.provisionalLicenseExpires
                                .toISOString()
                                .slice(0, 10)})`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {latest ? (
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            stale
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {latest.periodEnd.toISOString().slice(0, 10)} ·{" "}
                          {(latest.hoursDirect + latest.hoursIndirect).toFixed(1)}h
                        </span>
                      ) : p.isProvisionallyLicensed ? (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                          Missing
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {p.bcbsFastTrackSubmittedAt ? (
                        <span>
                          {p.bcbsFastTrackStatus ?? "SUBMITTED"} ·{" "}
                          {p.bcbsFastTrackSubmittedAt
                            .toISOString()
                            .slice(0, 10)}
                        </span>
                      ) : p.bcbsFastTrackEligible ? (
                        <span className="text-amber-700">Eligible</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
