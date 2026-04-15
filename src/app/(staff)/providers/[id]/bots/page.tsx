import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { BotStatusPanel } from "@/components/bots/BotStatusPanel";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProviderBotsPage({ params }: Props) {
  const { id } = await params;
  const provider = await db.provider.findUnique({
    where: { id },
    include: {
      providerType: true,
      botRuns: {
        orderBy: { queuedAt: "desc" },
        take: 50,
        include: {
          triggeredByUser: { select: { id: true, displayName: true } },
          verificationRecords: {
            select: { id: true, status: true, isFlagged: true, credentialType: true },
          },
        },
      },
      verificationRecords: {
        orderBy: { verifiedDate: "desc" },
        take: 20,
        include: {
          acknowledgedBy: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  if (!provider) notFound();

  return (
    <div className="space-y-6">
      <div>
        <a href={`/providers/${provider.id}`} className="text-blue-600 text-sm hover:underline">
          ← Back to {provider.legalFirstName} {provider.legalLastName}
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Bot Control Panel</h1>
        <p className="text-gray-500">Primary Source Verification bots for {provider.legalFirstName} {provider.legalLastName}</p>
      </div>

      <BotStatusPanel
        providerId={provider.id}
        providerType={provider.providerType.abbreviation}
        botRuns={provider.botRuns as Parameters<typeof BotStatusPanel>[0]["botRuns"]}
      />
    </div>
  );
}
