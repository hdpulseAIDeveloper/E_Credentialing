import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { ProviderStatusBadge } from "@/components/providers/ProviderStatusBadge";
import { ChecklistPanel } from "@/components/checklist/ChecklistPanel";
import { ProviderHeaderActions } from "@/components/providers/ProviderHeaderActions";
import { TaskManager } from "@/components/tasks/TaskManager";
import { AddEnrollmentModal } from "@/components/enrollments/AddEnrollmentModal";
import { AuditTrailPanel } from "@/components/audit/AuditTrailPanel";
import { CoiTrackingPanel } from "@/components/providers/CoiTrackingPanel";
import { MalpracticeVerificationPanel } from "@/components/providers/MalpracticeVerificationPanel";
import { TelehealthPanel } from "@/components/providers/TelehealthPanel";
import { OnsiteMeetingPanel } from "@/components/providers/OnsiteMeetingPanel";
import { CaqhSyncButton } from "@/components/providers/CaqhSyncButton";
import { HospitalPrivilegesPanel } from "@/components/providers/HospitalPrivilegesPanel";
import { PsvSlaPanel } from "@/components/providers/PsvSlaPanel";

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
        hospitalPrivileges: {
          orderBy: { facilityName: "asc" },
        },
        recredentialingCycles: {
          orderBy: { dueDate: "desc" as const },
          include: { committeeSession: { select: { id: true, sessionDate: true, status: true } } },
        },
        workHistoryVerifications: {
          orderBy: { createdAt: "desc" as const },
        },
        professionalReferences: {
          orderBy: { createdAt: "desc" as const },
        },
        practiceEvaluations: {
          orderBy: { dueDate: "desc" as const },
          include: {
            evaluator: { select: { id: true, displayName: true } },
            hospitalPrivilege: { select: { id: true, facilityName: true } },
          },
        },
        cmeCredits: {
          orderBy: { completedDate: "desc" as const },
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
          {/* P1 Gap #10 — one-click delegated audit packet */}
          <a
            href={`/api/providers/${provider.id}/audit-packet`}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            title="Download delegated-audit ZIP packet (NCQA / payer reviews)"
          >
            <span aria-hidden>⬇</span> Audit packet (.zip)
          </a>
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
            { id: "privileges", label: `Privileges (${provider.hospitalPrivileges.length})` },
            { id: "sanctions", label: "Sanctions/NPDB" },
            { id: "recredentialing", label: "Recredentialing" },
            { id: "work-history", label: "Work History Verification" },
            { id: "references", label: "References" },
            { id: "evaluations", label: "OPPE/FPPE" },
            { id: "cme", label: "CME" },
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
          <div className="space-y-6">
            {/* NCQA PSV SLA countdown (90-day initial / 120-day recred) */}
            <PsvSlaPanel
              applicationSubmittedAt={provider.applicationSubmittedAt}
              approvedAt={provider.approvedAt}
              recredentialingCycles={provider.recredentialingCycles.map((c: any) => ({
                id: c.id,
                cycleNumber: c.cycleNumber,
                startedAt: c.startedAt ?? null,
                dueDate: c.dueDate ?? null,
                completedAt: c.completedAt ?? null,
                status: c.status,
              }))}
            />

            {/* COI and Onsite Meeting */}
            <div className="grid grid-cols-2 gap-6">
              <CoiTrackingPanel
                providerId={provider.id}
                coiStatus={provider.coiStatus}
                coiBrokerName={provider.coiBrokerName}
                coiRequestedDate={provider.coiRequestedDate?.toISOString() ?? null}
                coiObtainedDate={provider.coiObtainedDate?.toISOString() ?? null}
                coiExpirationDate={provider.coiExpirationDate?.toISOString() ?? null}
              />
              <OnsiteMeetingPanel
                providerId={provider.id}
                meetingStatus={provider.onsiteMeetingStatus}
                meetingDate={provider.onsiteMeetingDate?.toISOString() ?? null}
                meetingNotes={provider.onsiteMeetingNotes}
              />
            </div>

            {/* P1 Gap #12 — malpractice carrier verification + threshold check */}
            <MalpracticeVerificationPanel providerId={provider.id} />

            {/* P1 Gap #15 — telehealth deepening: coverage / IMLC / platform certs */}
            <TelehealthPanel providerId={provider.id} />

            {/* Provider Info + Timeline */}
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
                  <dd className="font-medium flex items-center gap-2">
                    {provider.caqhId ?? "—"}
                    <CaqhSyncButton providerId={provider.id} caqhId={provider.caqhId} />
                  </dd>
                </div>
                {provider.caqhId && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">CAQH Profile</dt>
                      <dd className="font-medium">
                        {provider.profile?.caqhProfileStatus ?? "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Last Attestation</dt>
                      <dd className="font-medium">
                        {provider.profile?.caqhAttestationDate?.toLocaleDateString() ?? "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Re-attest Due</dt>
                      <dd className="font-medium">
                        {(() => {
                          const due = provider.profile?.caqhNextReattestDue;
                          if (!due) return "—";
                          const days = Math.ceil(
                            (due.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                          );
                          const label = due.toLocaleDateString();
                          if (days < 0) {
                            return (
                              <span className="text-red-600">
                                {label} (overdue {Math.abs(days)}d)
                              </span>
                            );
                          }
                          if (days <= 14) {
                            return (
                              <span className="text-amber-600">
                                {label} ({days}d)
                              </span>
                            );
                          }
                          return `${label} (${days}d)`;
                        })()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Essen Active Site</dt>
                      <dd className="font-medium">
                        {provider.profile?.caqhEssenIsActiveSite === true && (
                          <span className="text-green-600">Yes</span>
                        )}
                        {provider.profile?.caqhEssenIsActiveSite === false && (
                          <span className="text-red-600">No — request provider designate Essen</span>
                        )}
                        {provider.profile?.caqhEssenIsActiveSite == null && "—"}
                      </dd>
                    </div>
                  </>
                )}
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

        {tab === "privileges" && (
          <HospitalPrivilegesPanel
            providerId={provider.id}
            privileges={provider.hospitalPrivileges.map((hp: any) => ({
              id: hp.id,
              facilityName: hp.facilityName,
              privilegeType: hp.privilegeType,
              status: hp.status,
              appliedDate: hp.appliedDate?.toISOString() ?? null,
              approvedDate: hp.approvedDate?.toISOString() ?? null,
              expirationDate: hp.expirationDate?.toISOString() ?? null,
              denialReason: hp.denialReason ?? null,
              notes: hp.notes ?? null,
            }))}
          />
        )}

        {tab === "sanctions" && (
          <div className="space-y-6">
            {/* Sanctions Checks */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-semibold">OIG/SAM Sanctions Checks</h3>
              </div>
              <div className="divide-y">
                {provider.sanctionsChecks.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No sanctions checks recorded</div>
                ) : (
                  provider.sanctionsChecks.map((s: any) => (
                    <div key={s.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.source === "OIG" ? "OIG Exclusion Check" : "SAM.gov Check"}</div>
                        <div className="text-sm text-gray-500">
                          Run: {s.runDate.toLocaleDateString()} · Triggered: {s.triggeredBy.replace(/_/g, " ")}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        s.result === "CLEAR" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>{s.result}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* NPDB Records */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-semibold">NPDB Records</h3>
              </div>
              <div className="divide-y">
                {provider.npdbRecords.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No NPDB queries recorded</div>
                ) : (
                  provider.npdbRecords.map((n: any) => (
                    <div key={n.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{n.queryType.replace(/_/g, " ")} Query</div>
                        <div className="text-sm text-gray-500">
                          Date: {n.queryDate.toLocaleDateString()}
                          {n.queryConfirmationNumber && ` · Conf#: ${n.queryConfirmationNumber}`}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        n.result === "NO_REPORTS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>{n.result === "NO_REPORTS" ? "CLEAR" : `${n.reportCount} REPORTS`}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "recredentialing" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Recredentialing Cycles</h3>
              {provider.initialApprovalDate && (
                <span className="text-xs text-gray-500">
                  Initial Approval: {provider.initialApprovalDate.toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="divide-y">
              {provider.recredentialingCycles.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No recredentialing cycles</div>
              ) : (
                provider.recredentialingCycles.map((c: any) => {
                  const daysLeft = Math.floor((new Date(c.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={c.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Cycle #{c.cycleNumber}</div>
                          <div className="text-sm text-gray-500">
                            Due: {new Date(c.dueDate).toLocaleDateString()}
                            {c.committeeSession && (
                              <> · Session: {new Date(c.committeeSession.sessionDate).toLocaleDateString()}</>
                            )}
                          </div>
                          {c.notes && <div className="text-xs text-gray-400 mt-1">{c.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            c.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                            c.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                            c.status === "IN_PROGRESS" || c.status === "PSV_RUNNING" ? "bg-blue-100 text-blue-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{c.status.replace(/_/g, " ")}</span>
                          {c.status !== "COMPLETED" && daysLeft > 0 && (
                            <span className="text-xs text-gray-500">{daysLeft}d left</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "work-history" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Work History Verifications</h3>
            </div>
            <div className="divide-y">
              {provider.workHistoryVerifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No work history verification requests</div>
              ) : (
                provider.workHistoryVerifications.map((w: any) => (
                  <div key={w.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{w.employerName}</div>
                        <div className="text-sm text-gray-500">
                          {w.position && `${w.position} · `}
                          {w.contactName && `Contact: ${w.contactName} · `}
                          {w.startDate && `${new Date(w.startDate).toLocaleDateString()}`}
                          {w.endDate && ` – ${new Date(w.endDate).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        w.status === "RECEIVED" ? "bg-green-100 text-green-700" :
                        w.status === "SENT" || w.status === "REMINDER_SENT" ? "bg-blue-100 text-blue-700" :
                        w.status === "EXPIRED" || w.status === "DECLINED" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{w.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "references" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Professional References</h3>
            </div>
            <div className="divide-y">
              {provider.professionalReferences.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No professional reference requests</div>
              ) : (
                provider.professionalReferences.map((r: any) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.referenceName}</div>
                        <div className="text-sm text-gray-500">
                          {r.referenceTitle && `${r.referenceTitle} · `}
                          {r.relationship && `${r.relationship} · `}
                          {r.referenceEmail}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        r.status === "RECEIVED" ? "bg-green-100 text-green-700" :
                        r.status === "SENT" || r.status === "REMINDER_SENT" ? "bg-blue-100 text-blue-700" :
                        r.status === "EXPIRED" || r.status === "DECLINED" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{r.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "evaluations" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Practice Evaluations (OPPE/FPPE)</h3>
            </div>
            <div className="divide-y">
              {provider.practiceEvaluations.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No practice evaluations</div>
              ) : (
                provider.practiceEvaluations.map((e: any) => (
                  <div key={e.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {e.evaluationType} Evaluation
                          {e.hospitalPrivilege && ` — ${e.hospitalPrivilege.facilityName}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          Period: {new Date(e.periodStart).toLocaleDateString()} – {new Date(e.periodEnd).toLocaleDateString()}
                          {e.evaluator && ` · Evaluator: ${e.evaluator.displayName}`}
                        </div>
                        {e.findings && <div className="text-xs text-gray-400 mt-1">{e.findings}</div>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        e.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        e.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                        e.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{e.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "cme" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">CME Credits</h3>
              {provider.cmeCredits.length > 0 && (
                <span className="text-sm text-gray-500">
                  Total: {provider.cmeCredits.reduce((sum: number, c: any) => sum + c.credits, 0)} credits
                </span>
              )}
            </div>
            <div className="divide-y">
              {provider.cmeCredits.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No CME credits recorded</div>
              ) : (
                provider.cmeCredits.map((c: any) => (
                  <div key={c.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c.activityName}</div>
                      <div className="text-sm text-gray-500">
                        {c.category} · {new Date(c.completedDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-blue-600">{c.credits} credits</span>
                  </div>
                ))
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