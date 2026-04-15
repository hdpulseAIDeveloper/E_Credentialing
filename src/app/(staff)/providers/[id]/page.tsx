import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { ProviderStatusBadge } from "@/components/providers/ProviderStatusBadge";
import { ChecklistPanel } from "@/components/checklist/ChecklistPanel";
import { ProviderHeaderActions } from "@/components/providers/ProviderHeaderActions";
import { TaskManager } from "@/components/tasks/TaskManager";
import { AddEnrollmentModal } from "@/components/enrollments/AddEnrollmentModal";
import { AuditTrailPanel } from "@/components/audit/AuditTrailPanel";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProviderDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  const [provider, staffUsers] = await Promise.all([
    db.provider.findUnique({
      where: { id },
      include: {
        providerType: true,
        assignedSpecialist: { select: { id: true, displayName: true, email: true } },
        profile: true,
        licenses: { orderBy: [{ isPrimary: "desc" }, { state: "asc" }] },
        checklistItems: { include: { document: true } },
        tasks: {
          where: { status: { not: "COMPLETED" } },
          include: { assignedTo: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        communications: {
          include: { fromUser: { select: { id: true, displayName: true } } },
          orderBy: { sentAt: "desc" },
          take: 20,
        },
        verificationRecords: {
          orderBy: { verifiedDate: "desc" },
          take: 20,
        },
        botRuns: {
          orderBy: { queuedAt: "desc" },
          take: 10,
        },
        enrollments: {
          include: { assignedTo: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
        expirables: {
          orderBy: { expirationDate: "asc" },
        },
        sanctionsChecks: {
          orderBy: { runDate: "desc" },
          take: 5,
        },
        npdbRecords: {
          orderBy: { queryDate: "desc" },
          take: 5,
        },
      },
    }),
    db.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SPECIALIST", "MANAGER", "ADMIN"] },
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  if (!provider) notFound();

  const tab = tabParam ?? "overview";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {provider.legalFirstName} {provider.legalMiddleName ? `${provider.legalMiddleName} ` : ""}{provider.legalLastName}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-gray-500">{provider.providerType.name}</span>
            <ProviderStatusBadge status={provider.status} />
            {provider.npi && <span className="text-sm text-gray-400">NPI: {provider.npi}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm text-gray-500">
            {provider.assignedSpecialist && (
              <div>Specialist: {provider.assignedSpecialist.displayName}</div>
            )}
            {provider.applicationSubmittedAt && (
              <div>Submitted: {provider.applicationSubmittedAt.toLocaleDateString()}</div>
            )}
          </div>
          <ProviderHeaderActions
            providerId={provider.id}
            currentStatus={provider.status}
            currentNpi={provider.npi}
            currentDea={provider.deaNumber}
            currentCaqh={provider.caqhId}
            currentIcims={provider.icimsId}
            currentNotes={provider.notes}
            currentSpecialistId={provider.assignedSpecialistId}
            currentFirstName={provider.legalFirstName}
            currentLastName={provider.legalLastName}
            currentMiddleName={provider.legalMiddleName}
            currentMedicarePtan={provider.medicarePtan}
            currentMedicaidId={provider.medicaidId}
            staffUsers={staffUsers}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "documents", label: "Documents & Checklist" },
            { id: "verifications", label: "Verifications" },
            { id: "tasks", label: `Tasks (${provider.tasks.length})` },
            { id: "communications", label: "Communications" },
            { id: "enrollments", label: `Enrollments (${provider.enrollments.length})` },
            { id: "expirables", label: `Expirables (${provider.expirables.length})` },
            { id: "audit", label: "Audit Trail" },
          ].map((t) => (
            <a
              key={t.id}
              href={`?tab=${t.id}`}
              className={`py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {tab === "overview" && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Provider Information</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">NPI</dt>
                  <dd className="font-medium">{provider.npi ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">DEA</dt>
                  <dd className="font-medium">{provider.deaNumber ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">CAQH ID</dt>
                  <dd className="font-medium">{provider.caqhId ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">iCIMS ID</dt>
                  <dd className="font-medium">{provider.icimsId ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Provider Type</dt>
                  <dd className="font-medium">{provider.providerType.abbreviation}</dd>
                </div>
                {provider.notes && (
                  <div className="pt-2 border-t">
                    <dt className="text-gray-500 text-xs mb-1">Internal Notes</dt>
                    <dd className="text-sm text-gray-700">{provider.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="bg-white rounded-lg border p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Timeline</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Invited</dt>
                  <dd className="font-medium">{provider.inviteSentAt?.toLocaleDateString() ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">App Started</dt>
                  <dd className="font-medium">{provider.applicationStartedAt?.toLocaleDateString() ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">App Submitted</dt>
                  <dd className="font-medium">{provider.applicationSubmittedAt?.toLocaleDateString() ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Committee Ready</dt>
                  <dd className="font-medium">{provider.committeeReadyAt?.toLocaleDateString() ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Approved</dt>
                  <dd className="font-medium">{provider.approvedAt?.toLocaleDateString() ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {tab === "documents" && (
          <ChecklistPanel
            providerId={provider.id}
            checklistItems={provider.checklistItems}
            providerTypeId={provider.providerTypeId}
          />
        )}

        {tab === "verifications" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Verification Records</h3>
            </div>
            <div className="divide-y">
              {provider.verificationRecords.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No verification records yet</div>
              ) : (
                provider.verificationRecords.map((v) => (
                  <div key={v.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{v.credentialType}</div>
                      <div className="text-sm text-gray-500">
                        Verified: {v.verifiedDate.toLocaleDateString()}
                        {v.expirationDate && ` · Expires: ${v.expirationDate.toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {v.isFlagged && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">FLAGGED</span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          v.status === "VERIFIED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <TaskManager
            providerId={provider.id}
            tasks={provider.tasks as Parameters<typeof TaskManager>[0]["tasks"]}
            staffUsers={staffUsers}
          />
        )}

        {tab === "communications" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Communication History</h3>
            </div>
            <div className="divide-y">
              {provider.communications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No communications yet</div>
              ) : (
                provider.communications.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{c.communicationType}</span>
                      <span className="text-xs text-gray-400">{c.sentAt.toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1 line-clamp-2">{c.body}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "enrollments" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Enrollment Records</h3>
              <AddEnrollmentModal providerId={provider.id} staffUsers={staffUsers} />
            </div>
            <div className="divide-y">
              {provider.enrollments.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No enrollment records</div>
              ) : (
                provider.enrollments.map((e) => (
                  <a key={e.id} href={`/enrollments/${e.id}`} className="block p-4 hover:bg-gray-50">
                    <div className="flex justify-between">
                      <span className="font-medium">{e.payerName}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        e.status === "ENROLLED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{e.status}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {e.enrollmentType} · {e.submissionMethod}
                      {e.followUpDueDate && ` · Follow-up: ${e.followUpDueDate.toLocaleDateString()}`}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "expirables" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Expirable Credentials</h3>
            </div>
            <div className="divide-y">
              {provider.expirables.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No expirable credentials tracked</div>
              ) : (
                provider.expirables.map((exp) => {
                  const daysLeft = Math.floor((exp.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={exp.id} className="p-4 flex justify-between">
                      <div>
                        <div className="font-medium">{exp.expirableType}</div>
                        <div className="text-sm text-gray-500">Expires: {exp.expirationDate.toLocaleDateString()}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full h-fit ${
                        daysLeft < 0 ? "bg-red-100 text-red-700" :
                        daysLeft <= 14 ? "bg-red-100 text-red-700" :
                        daysLeft <= 30 ? "bg-orange-100 text-orange-700" :
                        daysLeft <= 60 ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {daysLeft < 0 ? "EXPIRED" : `${daysLeft}d left`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "audit" && (
          <AuditTrailPanel providerId={provider.id} />
        )}
      </div>
    </div>
  );
}
