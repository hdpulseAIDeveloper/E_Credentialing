/**
 * prisma/seed-extras.ts
 *
 * Demo data for Modules 11–20 (Phase 1+) — every table that was empty
 * after `npm run db:seed`. Run via `npm run db:seed:extras`.
 *
 * Idempotent: each block guards on `count() > 0` so re-running won't
 * duplicate. Safe to run after the main seed; assumes the main seed has
 * already created the 6 staff users + 14 demo providers.
 *
 * Coverage (table → rows after run):
 *   recredentialing_cycles          ≥ 6
 *   professional_references         ≥ 12
 *   work_history_verifications      ≥ 12
 *   payer_rosters                   ≥ 4
 *   roster_submissions              ≥ 8
 *   privilege_categories            ≥ 4
 *   privilege_items                 ≥ 12
 *   practice_evaluations            ≥ 8 (mix of OPPE + FPPE)
 *   cme_credits                     ≥ 12
 *   staff_training_records          ≥ 10
 *   training_assignments            ≥ 12
 *   supervision_attestations        ≥ 4
 *   telehealth_platform_certs       ≥ 6
 *   malpractice_verifications       ≥ 6
 *   monitoring_alerts               ≥ 8
 *   bot_exception_verdicts          ≥ 4
 *   ai_conversations + ai_messages  ≥ 6 / ≥ 18
 *   ai_decision_logs                ≥ 12
 *   api_keys                        ≥ 3
 *   saved_reports                   ≥ 5
 *   ncqa_criteria + assessments     ≥ 14 / ≥ 14
 *   ncqa_compliance_snapshots       ≥ 3
 *   compliance_audit_periods        ≥ 2
 *   compliance_evidence + gaps      ≥ 8 / ≥ 4
 *   peer_review_meetings + minutes  ≥ 3 / ≥ 5
 *   fsmb_pdc_subscriptions + events ≥ 4 / ≥ 6
 *   medicaid_enrollments            ≥ 6
 *   enrollment_follow_ups           ≥ 4
 *   directory_locations             ≥ 3
 *   directory_endpoints             ≥ 2
 *   directory_practitioner_roles    ≥ 6
 *   task_comments                   ≥ 6
 *   documents                       ≥ 8
 *   app_settings                    ≥ 4
 *   audit_logs                      ≥ 8 (chained)
 */

import {
  PrismaClient,
  RecredentialingStatus,
  ReferenceRequestStatus,
  RosterStatus,
  EvaluationType,
  EvaluationStatus,
  TrainingCourseFrequency,
  TrainingAssignmentStatus,
  TelehealthPlatformCertStatus,
  MalpracticeVerificationStatus,
  MonitoringAlertType,
  MonitoringAlertSeverity,
  MonitoringAlertStatus,
  BotExceptionAction,
  BotExceptionVerdictStatus,
  AiAssistantMode,
  AiMessageRole,
  AiHumanDecision,
  NcqaCategory,
  NcqaAssessmentStatus,
  ComplianceFramework,
  ComplianceControlStatus,
  ComplianceControlMaturity,
  ComplianceGapSeverity,
  ComplianceGapStatus,
  ComplianceAuditPeriodStatus,
  ComplianceEvidenceType,
  PeerReviewMeetingStatus,
  PeerReviewMinuteOutcome,
  FsmbPdcSubscriptionStatus,
  FsmbPdcEventType,
  FsmbPdcEventSeverity,
  FsmbPdcEventProcessingStatus,
  SupervisionAttestationStatus,
  MedicaidEnrollmentSubtype,
  MedicaidEnrollmentPath,
  MedicaidAffiliationStatus,
  DirectoryEndpointType,
  DocumentType,
  DocumentSource,
  OcrStatus,
  HospitalPrivilegeStatus,
} from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
const monthsAgo = (n: number) => new Date(Date.now() - n * 30 * 86400000);
const monthsFromNow = (n: number) => new Date(Date.now() + n * 30 * 86400000);

async function main() {
  console.log("Seeding extras (Modules 11–20)…\n");

  // ── Look up the seeded entities we'll attach to ────────────────────────────
  const users = await prisma.user.findMany();
  const userByEmail = new Map(users.map((u) => [u.email, u]));
  const admin = userByEmail.get("admin@hdpulseai.com");
  const sarah = userByEmail.get("sarah.johnson@essenmed.com");
  const michael = userByEmail.get("michael.chen@essenmed.com");
  const lisa = userByEmail.get("lisa.rodriguez@essenmed.com");
  const drPatel = userByEmail.get("dr.patel@essenmed.com");
  const drWilliams = userByEmail.get("dr.williams@essenmed.com");

  if (!admin || !sarah || !michael || !lisa || !drPatel || !drWilliams) {
    throw new Error(
      "Missing seeded users. Run `npm run db:seed` before `db:seed:extras`."
    );
  }

  const providers = await prisma.provider.findMany({ orderBy: { createdAt: "asc" } });
  if (providers.length === 0) {
    throw new Error(
      "No providers found. Run `npm run db:seed` before `db:seed:extras`."
    );
  }

  const byNpi = new Map(providers.map((p) => [p.npi ?? "", p]));
  const harrison = byNpi.get("1234567891")!;
  const santos   = byNpi.get("1234567892")!;
  const kim      = byNpi.get("1234567893")!;
  const walsh    = byNpi.get("1234567894")!;
  const russo    = byNpi.get("1234567895")!;
  const mendez   = byNpi.get("1234567896")!;
  const thompson = byNpi.get("1234567897")!;
  const davis    = byNpi.get("1234567898")!;
  const johnson  = byNpi.get("1234567901")!;
  const rivera   = byNpi.get("1234567902")!;
  const mitchell = byNpi.get("1234567903")!;
  const rachelKim= byNpi.get("1234567904")!;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. App settings
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.appSetting.count()) === 0) {
    await prisma.appSetting.createMany({
      data: [
        { key: "expirable.warning.days_default", value: "60",
          description: "Default lead time before an expirable triggers a warning email.",
          category: "expirables", updatedBy: admin.id },
        { key: "sanctions.run.cadence_days", value: "30",
          description: "OIG + SAM.gov sanctions sweep cadence in days.",
          category: "sanctions", updatedBy: admin.id },
        { key: "committee.quorum.minimum", value: "3",
          description: "Minimum number of committee members required to vote.",
          category: "committee", updatedBy: admin.id },
        { key: "outreach.invite.token_ttl_hours", value: "72",
          description: "Validity window for the BEGIN APPLICATION outreach token.",
          category: "onboarding", updatedBy: admin.id },
      ],
    });
    console.log("  ✓ app_settings: 4");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Recredentialing cycles
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.recredentialingCycle.count()) === 0) {
    const recredData = [
      { provider: kim,      cycle: 1, status: RecredentialingStatus.IN_PROGRESS,
        due: monthsFromNow(2),  started: daysAgo(40),  completed: null },
      { provider: davis,    cycle: 1, status: RecredentialingStatus.PSV_RUNNING,
        due: monthsFromNow(1),  started: daysAgo(60),  completed: null },
      { provider: mitchell, cycle: 2, status: RecredentialingStatus.COMPLETED,
        due: monthsAgo(2),      started: monthsAgo(8), completed: monthsAgo(2) },
      { provider: thompson, cycle: 1, status: RecredentialingStatus.PENDING,
        due: monthsFromNow(6),  started: null,         completed: null },
      { provider: santos,   cycle: 1, status: RecredentialingStatus.OVERDUE,
        due: daysAgo(15),       started: daysAgo(50),  completed: null },
      { provider: russo,    cycle: 1, status: RecredentialingStatus.APPLICATION_SENT,
        due: monthsFromNow(4),  started: daysAgo(7),   completed: null },
    ];
    for (const r of recredData) {
      await prisma.recredentialingCycle.create({
        data: {
          providerId: r.provider.id,
          cycleNumber: r.cycle,
          dueDate: r.due,
          startedAt: r.started,
          completedAt: r.completed,
          status: r.status,
          notes: r.status === RecredentialingStatus.OVERDUE
            ? "Provider has not responded to two outreach emails — escalation pending."
            : null,
        },
      });
    }
    console.log(`  ✓ recredentialing_cycles: ${recredData.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Professional references + Work history
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.professionalReference.count()) === 0) {
    const refTargets = [harrison, santos, walsh, mendez, thompson, johnson];
    for (const p of refTargets) {
      await prisma.professionalReference.createMany({
        data: [
          { providerId: p.id, referenceName: "Dr. Helena Martinez",
            referenceTitle: "Department Chair", referenceEmail: `helena.martinez+${p.npi}@partnerhospital.org`,
            referencePhone: "(212) 555-0181", relationship: "Former supervising physician",
            status: ReferenceRequestStatus.RECEIVED, requestSentAt: daysAgo(20),
            receivedAt: daysAgo(8),
            responseData: { responses: { "clinical_competence": "Excellent",
              "professionalism": "Excellent", "would_rehire": "Yes" } } },
          { providerId: p.id, referenceName: "Dr. Brian O'Connell",
            referenceTitle: "Medical Director", referenceEmail: `brian.oconnell+${p.npi}@partnerhospital.org`,
            referencePhone: "(212) 555-0192", relationship: "Peer attending",
            status: ReferenceRequestStatus.SENT, requestSentAt: daysAgo(5),
            reminderCount: 1, lastReminderAt: daysAgo(1) },
        ],
      });
    }
    console.log("  ✓ professional_references: 12");
  }

  if ((await prisma.workHistoryVerification.count()) === 0) {
    const wTargets = [harrison, santos, walsh, mendez, thompson, johnson];
    for (const p of wTargets) {
      await prisma.workHistoryVerification.createMany({
        data: [
          { providerId: p.id, employerName: "NYC Health + Hospitals / Bellevue",
            employerEmail: `verify+${p.npi}@nychealthandhospitals.org`,
            employerPhone: "(212) 562-4141", contactName: "HR Verifications",
            position: "Attending Physician", startDate: daysAgo(365 * 5),
            endDate: daysAgo(365 * 2), status: ReferenceRequestStatus.RECEIVED,
            requestSentAt: daysAgo(25), receivedAt: daysAgo(10) },
          { providerId: p.id, employerName: "Mount Sinai Beth Israel",
            employerEmail: `verifications+${p.npi}@mountsinai.org`,
            employerPhone: "(212) 420-2000", contactName: "Workforce Records",
            position: "Resident", startDate: daysAgo(365 * 8),
            endDate: daysAgo(365 * 5),
            status: ReferenceRequestStatus.REMINDER_SENT, requestSentAt: daysAgo(14),
            reminderCount: 2, lastReminderAt: daysAgo(2) },
        ],
      });
    }
    console.log("  ✓ work_history_verifications: 12");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Payer rosters + submissions
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.payerRoster.count()) === 0) {
    const rosters = await Promise.all([
      prisma.payerRoster.create({
        data: { payerName: "Aetna Better Health NY", rosterFormat: "csv",
          submissionMethod: "sftp", lastGeneratedAt: daysAgo(7), lastSubmittedAt: daysAgo(7),
          sftpHost: "sftp.aetnabetterhealth.example", sftpPort: 22,
          sftpUsername: "essen-roster", sftpUploadDir: "/inbound/essen",
          sftpAckDir: "/outbound/essen", sftpAckPattern: "{basename}.ack.json",
          sftpEnabled: true, templateConfig: { delimiter: ",", encoding: "utf-8" } } }),
      prisma.payerRoster.create({
        data: { payerName: "UnitedHealthcare Community Plan", rosterFormat: "csv",
          submissionMethod: "portal", lastGeneratedAt: daysAgo(14), lastSubmittedAt: daysAgo(14),
          templateConfig: { delimiter: ",", encoding: "utf-8" } } }),
      prisma.payerRoster.create({
        data: { payerName: "Anthem BCBS NY", rosterFormat: "xlsx",
          submissionMethod: "email", lastGeneratedAt: daysAgo(30), lastSubmittedAt: daysAgo(30) } }),
      prisma.payerRoster.create({
        data: { payerName: "Cigna", rosterFormat: "csv",
          submissionMethod: "portal", lastGeneratedAt: null, lastSubmittedAt: null } }),
    ]);
    console.log("  ✓ payer_rosters: 4");

    if ((await prisma.rosterSubmission.count()) === 0) {
      await prisma.rosterSubmission.createMany({
        data: [
          { rosterId: rosters[0].id, status: RosterStatus.ACKNOWLEDGED,
            providerCount: 14, submittedAt: daysAgo(7), submittedBy: sarah.id,
            acknowledgedAt: daysAgo(6), remoteFilename: "essen_aetna_2026_04_10.csv",
            ackFilename: "essen_aetna_2026_04_10.csv.ack.json" },
          { rosterId: rosters[0].id, status: RosterStatus.SUBMITTED,
            providerCount: 16, submittedAt: daysAgo(1), submittedBy: sarah.id,
            remoteFilename: "essen_aetna_2026_04_16.csv" },
          { rosterId: rosters[1].id, status: RosterStatus.ACKNOWLEDGED,
            providerCount: 14, submittedAt: daysAgo(14), submittedBy: michael.id,
            acknowledgedAt: daysAgo(13) },
          { rosterId: rosters[1].id, status: RosterStatus.VALIDATED,
            providerCount: 16 },
          { rosterId: rosters[2].id, status: RosterStatus.ACKNOWLEDGED,
            providerCount: 12, submittedAt: daysAgo(30), submittedBy: lisa.id,
            acknowledgedAt: daysAgo(28) },
          { rosterId: rosters[2].id, status: RosterStatus.ERROR,
            providerCount: 0, validationErrors: { errors: [
              { row: 3, field: "specialty", message: "Specialty 'Behavioral Health' not in payer's value set" } ] } },
          { rosterId: rosters[3].id, status: RosterStatus.DRAFT, providerCount: 0 },
          { rosterId: rosters[3].id, status: RosterStatus.GENERATED, providerCount: 14 },
        ],
      });
      console.log("  ✓ roster_submissions: 8");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Privileging library
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.privilegeCategory.count()) === 0) {
    const psych = await prisma.privilegeCategory.create({
      data: { name: "Psychiatry — Adult", specialty: "Psychiatry" } });
    const childPsych = await prisma.privilegeCategory.create({
      data: { name: "Psychiatry — Child & Adolescent", specialty: "Child Psychiatry" } });
    const intMed = await prisma.privilegeCategory.create({
      data: { name: "Internal Medicine — General", specialty: "Internal Medicine" } });
    const addiction = await prisma.privilegeCategory.create({
      data: { name: "Addiction Medicine", specialty: "Addiction Medicine" } });
    console.log("  ✓ privilege_categories: 4");

    await prisma.privilegeItem.createMany({
      data: [
        { categoryId: psych.id, name: "Outpatient Psychiatric Evaluation",
          cptCodes: ["90791", "90792"], icd10Codes: [], isCore: true },
        { categoryId: psych.id, name: "Pharmacotherapy Management",
          cptCodes: ["90863"], icd10Codes: [], isCore: true },
        { categoryId: psych.id, name: "Psychotherapy 30/45/60 minutes",
          cptCodes: ["90832", "90834", "90837"], icd10Codes: [], isCore: true },
        { categoryId: psych.id, name: "Electroconvulsive Therapy (ECT)",
          cptCodes: ["90870"], icd10Codes: [], isCore: false, requiresFppe: true },
        { categoryId: childPsych.id, name: "Pediatric Psychopharmacology",
          cptCodes: ["90863"], icd10Codes: [], isCore: true },
        { categoryId: childPsych.id, name: "Family Therapy",
          cptCodes: ["90847"], icd10Codes: [], isCore: true },
        { categoryId: childPsych.id, name: "Autism Spectrum Disorder Diagnosis",
          cptCodes: ["96112"], icd10Codes: ["F84.0"], isCore: false, requiresFppe: true },
        { categoryId: intMed.id, name: "Outpatient E/M — New Patient",
          cptCodes: ["99202", "99203", "99204", "99205"], icd10Codes: [], isCore: true },
        { categoryId: intMed.id, name: "Outpatient E/M — Established Patient",
          cptCodes: ["99212", "99213", "99214", "99215"], icd10Codes: [], isCore: true },
        { categoryId: intMed.id, name: "Annual Physical Examination",
          cptCodes: ["99396", "99397"], icd10Codes: ["Z00.00"], isCore: true },
        { categoryId: addiction.id, name: "Buprenorphine Treatment",
          cptCodes: ["G2086", "G2087"], icd10Codes: ["F11.20"], isCore: true,
          requiresFppe: true },
        { categoryId: addiction.id, name: "Methadone Maintenance Oversight",
          cptCodes: ["H0020"], icd10Codes: ["F11.20"], isCore: false, requiresFppe: true },
      ],
    });
    console.log("  ✓ privilege_items: 12");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Practice evaluations (OPPE + FPPE)
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.practiceEvaluation.count()) === 0) {
    const evalData = [
      { provider: kim,      type: EvaluationType.OPPE, status: EvaluationStatus.COMPLETED,
        period: 6, due: daysAgo(10), completedDays: 12,
        evaluator: drPatel.id,
        findings: "All quality indicators within expected range. No corrective action required.",
        trigger: "scheduled_periodic" },
      { provider: davis,    type: EvaluationType.OPPE, status: EvaluationStatus.IN_PROGRESS,
        period: 6, due: daysFromNow(20), completedDays: null,
        evaluator: drWilliams.id, findings: null, trigger: "scheduled_periodic" },
      { provider: mitchell, type: EvaluationType.OPPE, status: EvaluationStatus.COMPLETED,
        period: 6, due: daysAgo(45), completedDays: 50,
        evaluator: drPatel.id, findings: "Exceeds benchmarks for patient satisfaction and follow-up adherence.",
        trigger: "scheduled_periodic" },
      { provider: santos,   type: EvaluationType.OPPE, status: EvaluationStatus.OVERDUE,
        period: 6, due: daysAgo(20), completedDays: null,
        evaluator: drPatel.id, findings: null, trigger: "scheduled_periodic" },
      { provider: thompson, type: EvaluationType.FPPE, status: EvaluationStatus.IN_PROGRESS,
        period: 3, due: daysFromNow(15), completedDays: null,
        evaluator: drWilliams.id,
        findings: "Newly granted geriatric psych privileges — first 10 admissions under direct review.",
        trigger: "new_privilege_grant" },
      { provider: harrison, type: EvaluationType.FPPE, status: EvaluationStatus.SCHEDULED,
        period: 3, due: daysFromNow(45), completedDays: null,
        evaluator: drWilliams.id, findings: null, trigger: "new_provider_onboarding" },
      { provider: walsh,    type: EvaluationType.OPPE, status: EvaluationStatus.SCHEDULED,
        period: 6, due: daysFromNow(60), completedDays: null,
        evaluator: drPatel.id, findings: null, trigger: "scheduled_periodic" },
      { provider: johnson,  type: EvaluationType.FPPE, status: EvaluationStatus.SCHEDULED,
        period: 3, due: daysFromNow(40), completedDays: null,
        evaluator: drWilliams.id, findings: null, trigger: "new_privilege_grant" },
    ];
    for (const e of evalData) {
      await prisma.practiceEvaluation.create({
        data: {
          providerId: e.provider.id,
          evaluationType: e.type,
          status: e.status,
          periodStart: monthsAgo(e.period),
          periodEnd: e.due,
          dueDate: e.due,
          completedAt: e.completedDays ? daysAgo(e.completedDays) : null,
          evaluatorId: e.evaluator,
          findings: e.findings,
          recommendation: e.findings ? "Continue current privileges; reassess at next OPPE cycle." : null,
          trigger: e.trigger,
          indicators: e.status === EvaluationStatus.COMPLETED ? {
            chartReviewScore: 96, patientComplaints: 0, mortalityReview: "n/a",
            timelyDocumentation: "100%", peerFeedback: "Excellent",
          } : undefined,
        },
      });
    }
    console.log(`  ✓ practice_evaluations: ${evalData.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CME credits
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.cmeCredit.count()) === 0) {
    const cmeProviders = [harrison, santos, kim, thompson, davis, mitchell];
    const activities = [
      { name: "AMA PRA Category 1: NEJM Knowledge+",   credits: 12, cat: "Category 1" },
      { name: "APA Annual Meeting 2025 — Live",         credits: 18, cat: "Category 1" },
      { name: "ABMS MOC Part 2 Self-Assessment",        credits: 8,  cat: "Category 1" },
      { name: "Essen Internal Grand Rounds",            credits: 4,  cat: "Category 2" },
    ];
    for (const p of cmeProviders) {
      const a1 = activities[Math.floor(Math.random() * activities.length)]!;
      const a2 = activities[Math.floor(Math.random() * activities.length)]!;
      await prisma.cmeCredit.createMany({
        data: [
          { providerId: p.id, activityName: a1.name, category: a1.cat,
            credits: a1.credits, completedDate: daysAgo(60 + Math.floor(Math.random() * 100)) },
          { providerId: p.id, activityName: a2.name, category: a2.cat,
            credits: a2.credits, completedDate: daysAgo(20 + Math.floor(Math.random() * 60)) },
        ],
      });
    }
    console.log(`  ✓ cme_credits: ${cmeProviders.length * 2}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Staff training records + assignments
  // ─────────────────────────────────────────────────────────────────────────
  const courses = await prisma.trainingCourse.findMany();
  if (courses.length === 0) {
    console.warn("  ! training_courses empty — skipping training records.");
  } else if ((await prisma.staffTrainingRecord.count()) === 0) {
    const staffUsers = [sarah, michael, lisa, drPatel, drWilliams];
    for (const u of staffUsers) {
      for (const c of courses.slice(0, 2)) {
        await prisma.staffTrainingRecord.create({
          data: {
            userId: u.id, courseId: c.id, courseName: c.title,
            courseCategory: c.category,
            completedAt: daysAgo(30 + Math.floor(Math.random() * 200)),
            expiresAt: daysFromNow(180 + Math.floor(Math.random() * 200)),
            scorePercent: 90 + Math.floor(Math.random() * 10),
            source: "manual",
          },
        });
      }
    }
    console.log(`  ✓ staff_training_records: ${staffUsers.length * 2}`);
  }

  if ((await prisma.trainingAssignment.count()) === 0 && courses.length > 0) {
    const staffUsers = [sarah, michael, lisa, drPatel, drWilliams, admin];
    for (const u of staffUsers) {
      for (const c of courses.slice(0, 2)) {
        const r = Math.random();
        const status = r < 0.5 ? TrainingAssignmentStatus.COMPLETED
                     : r < 0.8 ? TrainingAssignmentStatus.IN_PROGRESS
                     :           TrainingAssignmentStatus.OVERDUE;
        try {
          await prisma.trainingAssignment.create({
            data: {
              userId: u.id, courseId: c.id,
              dueDate: status === TrainingAssignmentStatus.OVERDUE
                ? daysAgo(10) : daysFromNow(30),
              completedAt: status === TrainingAssignmentStatus.COMPLETED ? daysAgo(15) : null,
              status,
              remindersSent: status === TrainingAssignmentStatus.OVERDUE ? 3 : 0,
              lastReminderSentAt: status === TrainingAssignmentStatus.OVERDUE ? daysAgo(2) : null,
            },
          });
        } catch {
          // unique constraint (user, course) — ignore duplicates
        }
      }
    }
    console.log(`  ✓ training_assignments: ${staffUsers.length * 2}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Supervision attestations (LCSW / LMHC providers)
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.supervisionAttestation.count()) === 0) {
    const supervisedProviders = [mendez, rivera];
    for (const p of supervisedProviders) {
      await prisma.supervisionAttestation.createMany({
        data: [
          { providerId: p.id, supervisorName: "Dr. Helena Martinez, LCSW-R",
            supervisorLicenseNum: "LCSWR-12345", supervisorLicenseState: "NY",
            supervisorEmail: "helena.martinez@partnerhospital.org",
            supervisorLicenseType: "LCSW-R",
            periodStart: monthsAgo(6), periodEnd: monthsAgo(3),
            hoursDirect: 50, hoursIndirect: 25,
            attestationDate: monthsAgo(3),
            status: SupervisionAttestationStatus.ACCEPTED },
          { providerId: p.id, supervisorName: "Dr. Helena Martinez, LCSW-R",
            supervisorLicenseNum: "LCSWR-12345", supervisorLicenseState: "NY",
            supervisorEmail: "helena.martinez@partnerhospital.org",
            supervisorLicenseType: "LCSW-R",
            periodStart: monthsAgo(3), periodEnd: monthsFromNow(0),
            hoursDirect: 48, hoursIndirect: 22,
            status: SupervisionAttestationStatus.SUBMITTED },
        ],
      });
    }
    console.log(`  ✓ supervision_attestations: ${supervisedProviders.length * 2}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Telehealth platform certs
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.telehealthPlatformCert.count()) === 0) {
    const certs = [
      { provider: kim, platform: "Teladoc",       status: TelehealthPlatformCertStatus.CERTIFIED,
        certified: daysAgo(60), expires: daysFromNow(305) },
      { provider: kim, platform: "Doctor on Demand", status: TelehealthPlatformCertStatus.IN_TRAINING,
        certified: null, expires: null },
      { provider: thompson, platform: "Teladoc",  status: TelehealthPlatformCertStatus.CERTIFIED,
        certified: daysAgo(30), expires: daysFromNow(335) },
      { provider: davis,    platform: "Amwell",   status: TelehealthPlatformCertStatus.CERTIFIED,
        certified: daysAgo(120), expires: daysFromNow(245) },
      { provider: mitchell, platform: "Teladoc",  status: TelehealthPlatformCertStatus.EXPIRED,
        certified: daysAgo(400), expires: daysAgo(35) },
      { provider: walsh,    platform: "Doctor on Demand", status: TelehealthPlatformCertStatus.PENDING,
        certified: null, expires: null },
    ];
    for (const c of certs) {
      await prisma.telehealthPlatformCert.create({
        data: {
          providerId: c.provider.id, platformName: c.platform,
          certificateNumber: c.status === TelehealthPlatformCertStatus.CERTIFIED
            ? `CERT-${Math.floor(Math.random() * 900000) + 100000}` : null,
          status: c.status,
          trainingStartedAt: c.certified ? daysAgo(180) : daysAgo(7),
          trainingCompletedAt: c.certified ?? undefined,
          certifiedAt: c.certified ?? undefined,
          expiresAt: c.expires ?? undefined,
        },
      });
    }
    console.log(`  ✓ telehealth_platform_certs: ${certs.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Malpractice verifications
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.malpracticeVerification.count()) === 0) {
    const malpracticeData = [
      { provider: harrison, status: MalpracticeVerificationStatus.RECEIVED,
        carrier: "MedPro Group", thresholdMet: true,
        perOcc: BigInt(100_000_000), agg: BigInt(300_000_000) },
      { provider: santos,   status: MalpracticeVerificationStatus.SENT,
        carrier: "The Doctors Company", thresholdMet: null, perOcc: null, agg: null },
      { provider: kim,      status: MalpracticeVerificationStatus.RECEIVED,
        carrier: "MedPro Group", thresholdMet: true,
        perOcc: BigInt(100_000_000), agg: BigInt(300_000_000) },
      { provider: thompson, status: MalpracticeVerificationStatus.RECEIVED,
        carrier: "ProAssurance", thresholdMet: false,
        perOcc: BigInt(50_000_000), agg: BigInt(150_000_000) },
      { provider: davis,    status: MalpracticeVerificationStatus.REMINDER_SENT,
        carrier: "MagMutual", thresholdMet: null, perOcc: null, agg: null },
      { provider: mitchell, status: MalpracticeVerificationStatus.EXPIRED,
        carrier: "MedPro Group", thresholdMet: null, perOcc: null, agg: null },
    ];
    for (const m of malpracticeData) {
      await prisma.malpracticeVerification.create({
        data: {
          providerId: m.provider.id, carrierName: m.carrier,
          contactName: "Carrier Verifications Team",
          contactEmail: `verify@${m.carrier.toLowerCase().replace(/\s+/g, "")}.example`,
          policyNumber: `POL-${Math.floor(Math.random() * 9000000) + 1000000}`,
          expectedExpDate: daysFromNow(180),
          status: m.status,
          requestSentAt: daysAgo(15),
          receivedAt: m.status === MalpracticeVerificationStatus.RECEIVED ? daysAgo(3) : null,
          reportedPerOccurrenceCents: m.perOcc,
          reportedAggregateCents: m.agg,
          reportedEffectiveDate: m.thresholdMet === true || m.thresholdMet === false ? daysAgo(90) : null,
          reportedExpirationDate: m.thresholdMet === true || m.thresholdMet === false ? daysFromNow(275) : null,
          thresholdMet: m.thresholdMet,
          thresholdNotes: m.thresholdMet === false
            ? "Reported $500K/$1.5M is below Essen Main facility minimum of $1M/$3M." : null,
          reminderCount: m.status === MalpracticeVerificationStatus.REMINDER_SENT ? 2 : 0,
          lastReminderAt: m.status === MalpracticeVerificationStatus.REMINDER_SENT ? daysAgo(2) : null,
        },
      });
    }
    console.log(`  ✓ malpractice_verifications: ${malpracticeData.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Monitoring alerts
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.monitoringAlert.count()) === 0) {
    const alerts = [
      { provider: harrison, type: MonitoringAlertType.LICENSE_STATUS_CHANGE,
        severity: MonitoringAlertSeverity.WARNING, status: MonitoringAlertStatus.OPEN,
        title: "NY medical license status update",
        description: "NY OPMC poll detected status change from ACTIVE to UNDER_REVIEW for license #287654. Manual review needed.",
        source: "NY_OPMC_POLL" },
      { provider: thompson, type: MonitoringAlertType.MALPRACTICE_COVERAGE_BELOW_MIN,
        severity: MonitoringAlertSeverity.CRITICAL, status: MonitoringAlertStatus.OPEN,
        title: "Malpractice coverage below facility minimum",
        description: "Carrier reported $500K/$1.5M; Essen Main minimum is $1M/$3M.",
        source: "MALPRACTICE_VERIFICATION" },
      { provider: kim, type: MonitoringAlertType.NPDB_NEW_REPORT,
        severity: MonitoringAlertSeverity.WARNING, status: MonitoringAlertStatus.ACKNOWLEDGED,
        title: "NPDB Continuous Query: new report filed",
        description: "Routine query returned a new affiliated-action report (Type 11) — full report attached.",
        source: "NPDB_CONTINUOUS",
        ackBy: lisa.id, ackAt: daysAgo(2) },
      { provider: davis, type: MonitoringAlertType.SAM_EXCLUSION_ADDED,
        severity: MonitoringAlertSeverity.INFO, status: MonitoringAlertStatus.RESOLVED,
        title: "SAM.gov match — false positive cleared",
        description: "SAM.gov returned a partial-name match. Manual review confirmed mismatch (different DOB and SSN-4).",
        source: "SAM_GOV_WEBHOOK",
        ackBy: sarah.id, ackAt: daysAgo(8),
        resolveBy: sarah.id, resolveAt: daysAgo(8) },
      { provider: mitchell, type: MonitoringAlertType.BOARD_CERT_LAPSED,
        severity: MonitoringAlertSeverity.WARNING, status: MonitoringAlertStatus.OPEN,
        title: "ABIM board certification lapsed",
        description: "ABIM verification poll: certification expired on " + daysAgo(30).toISOString().slice(0, 10),
        source: "ABMS_POLL" },
      { provider: walsh, type: MonitoringAlertType.CAQH_ATTESTATION_DUE,
        severity: MonitoringAlertSeverity.INFO, status: MonitoringAlertStatus.OPEN,
        title: "CAQH attestation due in 21 days",
        description: "Re-attestation prompt — CAQH ProView next due: " + daysFromNow(21).toISOString().slice(0, 10),
        source: "CAQH_REATTESTATION_SWEEP" },
      { provider: rivera, type: MonitoringAlertType.LICENSE_DISCIPLINARY_ACTION,
        severity: MonitoringAlertSeverity.CRITICAL, status: MonitoringAlertStatus.ACKNOWLEDGED,
        title: "FSMB PDC: disciplinary action filed",
        description: "FSMB Practitioner Data Center reported a censure entered by NY for the supervising clinician.",
        source: "FSMB_PDC",
        ackBy: lisa.id, ackAt: daysAgo(1) },
      { provider: johnson, type: MonitoringAlertType.DEA_STATUS_CHANGE,
        severity: MonitoringAlertSeverity.INFO, status: MonitoringAlertStatus.OPEN,
        title: "DEA renewal window opens",
        description: "DEA renewal opens in 60 days. No action needed yet.",
        source: "DEA_RENEWAL_SWEEP" },
    ];
    for (const a of alerts) {
      await prisma.monitoringAlert.create({
        data: {
          providerId: a.provider.id, type: a.type, severity: a.severity, status: a.status,
          source: a.source, title: a.title, description: a.description,
          evidence: { rawSource: a.source, capturedAt: new Date().toISOString() },
          acknowledgedById: (a as any).ackBy ?? null,
          acknowledgedAt: (a as any).ackAt ?? null,
          resolvedById: (a as any).resolveBy ?? null,
          resolvedAt: (a as any).resolveAt ?? null,
        },
      });
    }
    console.log(`  ✓ monitoring_alerts: ${alerts.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Bot exception verdicts (depends on bot_runs from main seed)
  // ─────────────────────────────────────────────────────────────────────────
  const botRuns = await prisma.botRun.findMany({ take: 4 });
  if ((await prisma.botExceptionVerdict.count()) === 0 && botRuns.length > 0) {
    const verdictDefs = [
      { run: botRuns[0]!, action: BotExceptionAction.RETRY_NOW,
        reason: "FAILED",   conf: 0.92, src: "rules" as const,
        rationale: "Transient timeout against state board portal — page returned 504 twice in 10m. Retry recommended." },
      { run: botRuns[1]!, action: BotExceptionAction.ESCALATE_TO_STAFF,
        reason: "REQUIRES_MANUAL", conf: 0.78, src: "llm" as const,
        rationale: "Captcha challenge encountered after 3 attempts; site appears to have introduced a new MFA step." },
      { run: botRuns[2]!, action: BotExceptionAction.RAISE_ALERT,
        reason: "FLAGGED",  conf: 0.66, src: "llm" as const,
        rationale: "Verification PDF contains 'PROBATION' watermark. Treat as adverse finding pending staff review." },
      { run: botRuns[3] ?? botRuns[0]!, action: BotExceptionAction.RETRY_LATER,
        reason: "FAILED",   conf: 0.85, src: "rules" as const,
        rationale: "Site is returning 503 across all probes — likely scheduled maintenance window. Defer 4h." },
    ];
    for (const v of verdictDefs) {
      await prisma.botExceptionVerdict.create({
        data: {
          botRunId: v.run.id, providerId: v.run.providerId,
          triggerReason: v.reason, recommendedAction: v.action,
          rationale: v.rationale, confidence: v.conf, source: v.src,
          modelUsed: v.src === "llm" ? "Azure OpenAI gpt-4o-mini-2026-04" : null,
          status: v.action === BotExceptionAction.RETRY_NOW
            ? BotExceptionVerdictStatus.AUTO_EXECUTED : BotExceptionVerdictStatus.PENDING_REVIEW,
          evidence: { runStatus: v.reason, attempts: v.run.attemptCount },
        },
      });
    }
    console.log(`  ✓ bot_exception_verdicts: ${verdictDefs.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 14. AI conversations + messages
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.aiConversation.count()) === 0) {
    const convoSpecs = [
      { mode: AiAssistantMode.STAFF_COACH, user: sarah.id, provider: santos.id,
        title: "Is Maria Santos ready for committee?",
        msgs: [
          { role: AiMessageRole.USER, content: "Is Maria Santos ready for committee review?" },
          { role: AiMessageRole.ASSISTANT, content:
            "Yes. Her verifications are complete (license, DEA, board cert, NPDB clear, OIG/SAM clear). Recommend adding her to the next session." },
        ] },
      { mode: AiAssistantMode.STAFF_COACH, user: michael.id, provider: walsh.id,
        title: "What's missing for Jennifer Walsh?",
        msgs: [
          { role: AiMessageRole.USER, content: "What's blocking Jennifer Walsh's application?" },
          { role: AiMessageRole.ASSISTANT, content:
            "BLS card and Professional Liability Insurance are both missing. Her last outreach was 5 days ago — recommend a follow-up." },
        ] },
      { mode: AiAssistantMode.PROVIDER, user: null, provider: harrison.id,
        title: "Application status check",
        msgs: [
          { role: AiMessageRole.USER, content: "What is the status of my application?" },
          { role: AiMessageRole.ASSISTANT, content:
            "Your application is in 'Verification In Progress'. State license has been verified; DEA verification is currently running. No action needed from you right now." },
        ] },
      { mode: AiAssistantMode.STAFF_COACH, user: lisa.id, provider: null,
        title: "NCQA CR-1 evidence gaps",
        msgs: [
          { role: AiMessageRole.USER, content: "Where are we on NCQA CR-1 license-verification evidence?" },
          { role: AiMessageRole.ASSISTANT, content:
            "Of 14 active providers, 13 have a primary-source license verification on file dated within 180 days. James Harrison's verification is in flight — expected to complete today." },
        ] },
      { mode: AiAssistantMode.STAFF_COACH, user: sarah.id, provider: thompson.id,
        title: "Geriatric psych privilege questions",
        msgs: [
          { role: AiMessageRole.USER, content: "What FPPE indicators apply to a new geriatric psych privilege?" },
          { role: AiMessageRole.ASSISTANT, content:
            "Joint Commission NPG-12 requires: (1) review of first 10 admissions, (2) chart review of medication choices for the 65+ cohort, (3) one direct observation of an inpatient consult." },
        ] },
      { mode: AiAssistantMode.PROVIDER, user: null, provider: walsh.id,
        title: "How do I upload my BLS card?",
        msgs: [
          { role: AiMessageRole.USER, content: "How do I upload my BLS card?" },
          { role: AiMessageRole.ASSISTANT, content:
            "From your provider portal home, choose 'Documents' → 'Upload'. Pick 'BLS Card', then drop the PDF or photo. The system will OCR the expiration date automatically." },
        ] },
    ];
    for (const c of convoSpecs) {
      const convo = await prisma.aiConversation.create({
        data: {
          mode: c.mode, userId: c.user, providerId: c.provider, title: c.title,
          modelDeployment: "azure-openai-gpt-4o-2024-08-06",
        },
      });
      for (const m of c.msgs) {
        await prisma.aiMessage.create({
          data: {
            conversationId: convo.id, role: m.role, content: m.content,
            citations: m.role === AiMessageRole.ASSISTANT
              ? [{ source: "docs/planning/scope.md", section: "Module 11" }] : [],
            promptTokens: m.role === AiMessageRole.USER ? Math.floor(Math.random() * 50) + 10 : null,
            completionTokens: m.role === AiMessageRole.ASSISTANT ? Math.floor(Math.random() * 200) + 40 : null,
            latencyMs: m.role === AiMessageRole.ASSISTANT ? Math.floor(Math.random() * 1500) + 400 : null,
          },
        });
      }
    }
    console.log(`  ✓ ai_conversations: ${convoSpecs.length} (with ${convoSpecs.reduce((a, b) => a + b.msgs.length, 0)} messages)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 15. AI decision logs (governance audit trail)
  // ─────────────────────────────────────────────────────────────────────────
  const modelCards = await prisma.aiModelCard.findMany();
  if ((await prisma.aiDecisionLog.count()) === 0 && modelCards.length > 0) {
    const classifierCard = modelCards.find((c) => c.name.includes("Document Classifier")) ?? modelCards[0]!;
    const coachCard      = modelCards.find((c) => c.name.includes("Compliance Coach")) ?? modelCards[0]!;
    const orchestratorCard = modelCards.find((c) => c.name.includes("Bot Exception")) ?? modelCards[0]!;
    const decisions = [
      { card: classifierCard, feature: "document.classify", provider: harrison,
        prompt: "PDF, 1 page, contains 'Drug Enforcement Administration' and 'CERTIFICATE OF REGISTRATION'.",
        suggested: "DEA_CERTIFICATE", rationale: "Filename + content keywords match DEA pattern.",
        confidence: 0.97, decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: classifierCard, feature: "document.classify", provider: santos,
        prompt: "JPG, photo of card. OCR text: 'BLS Provider American Heart Association'.",
        suggested: "BLS_CARD", rationale: "Text mentions BLS and AHA — clear match.",
        confidence: 0.99, decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: classifierCard, feature: "document.classify", provider: walsh,
        prompt: "PDF, 2 pages, contains 'NCCPA Certification' and 'PA-C'.",
        suggested: "BOARD_CERTIFICATION", rationale: "NCCPA = PA board cert.",
        confidence: 0.95, decision: AiHumanDecision.ACCEPTED, decisionBy: michael.id },
      { card: classifierCard, feature: "document.classify", provider: thompson,
        prompt: "PDF, 1 page. OCR: 'Professional Liability Certificate of Insurance'.",
        suggested: "PROFESSIONAL_LIABILITY_INSURANCE", rationale: "Matches malpractice COI template.",
        confidence: 0.93, decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: classifierCard, feature: "document.classify", provider: russo,
        prompt: "PDF, 4 pages, contains 'Curriculum Vitae'.",
        suggested: "CV_RESUME", rationale: "CV header detected.", confidence: 0.96,
        decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: classifierCard, feature: "document.classify", provider: davis,
        prompt: "PDF, 1 page. Multiple seals; OCR partial: 'Practitioner ... Diploma'.",
        suggested: "MEDICAL_SCHOOL_DIPLOMA", rationale: "Diploma keyword + seal pattern.",
        confidence: 0.71, decision: AiHumanDecision.MODIFIED, decisionBy: michael.id,
        humanNote: "Actually a Graduate Certificate, not Medical School Diploma." },
      { card: coachCard, feature: "compliance.coach", provider: santos,
        prompt: "Is Maria Santos ready for committee?",
        suggested: null, rationale: "All verifications complete; recommend adding to next session.",
        confidence: 0.88, decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: coachCard, feature: "compliance.coach", provider: walsh,
        prompt: "What's blocking Jennifer Walsh?",
        suggested: null, rationale: "BLS and PLI missing; outreach 5 days old.",
        confidence: 0.91, decision: AiHumanDecision.ACCEPTED, decisionBy: michael.id },
      { card: coachCard, feature: "compliance.coach", provider: null,
        prompt: "NCQA CR-1 evidence gaps?",
        suggested: null, rationale: "13/14 providers have current PSV. Harrison in flight.",
        confidence: 0.84, decision: AiHumanDecision.ACCEPTED, decisionBy: lisa.id },
      { card: orchestratorCard, feature: "exception_routing", provider: harrison,
        prompt: "PSV bot run failed with 504 twice in 10m.",
        suggested: "RETRY_NOW", rationale: "Transient timeout pattern.", confidence: 0.92,
        decision: AiHumanDecision.ACCEPTED, decisionBy: sarah.id },
      { card: orchestratorCard, feature: "exception_routing", provider: kim,
        prompt: "Verification PDF contains 'PROBATION' watermark.",
        suggested: "RAISE_ALERT", rationale: "Adverse finding pending staff review.",
        confidence: 0.66, decision: AiHumanDecision.PENDING, decisionBy: null },
      { card: orchestratorCard, feature: "exception_routing", provider: davis,
        prompt: "Captcha challenge after 3 attempts.",
        suggested: "ESCALATE_TO_STAFF", rationale: "New MFA step on the source site.",
        confidence: 0.78, decision: AiHumanDecision.ACCEPTED, decisionBy: michael.id },
    ];
    for (const d of decisions) {
      await prisma.aiDecisionLog.create({
        data: {
          modelCardId: d.card.id, feature: d.feature,
          providerId: d.provider?.id ?? null,
          entityType: d.feature.startsWith("document") ? "Document" : "Provider",
          entityId: d.provider?.id ?? "n/a",
          promptSummary: d.prompt,
          responseSummary: d.suggested ?? d.rationale.slice(0, 100),
          suggestedAction: d.suggested,
          rationale: d.rationale,
          citations: [],
          confidenceScore: d.confidence,
          humanDecision: d.decision,
          humanDecisionById: d.decisionBy,
          humanDecisionAt: d.decision === AiHumanDecision.PENDING ? null
            : daysAgo(Math.floor(Math.random() * 20) + 1),
          humanNote: (d as any).humanNote ?? null,
          containsPhi: d.provider !== null,
          promptTokens: Math.floor(Math.random() * 200) + 50,
          completionTokens: Math.floor(Math.random() * 300) + 60,
          latencyMs: Math.floor(Math.random() * 2000) + 300,
        },
      });
    }
    console.log(`  ✓ ai_decision_logs: ${decisions.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 16. API keys
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.apiKey.count()) === 0) {
    const keys = [
      { name: "FHIR Read-Only — Aetna PDex Discovery",
        perms: { fhir: { read: ["Practitioner", "PractitionerRole", "Organization", "Location"] } },
        active: true, lastUsed: daysAgo(2), expires: daysFromNow(180) },
      { name: "Internal Roster Service",
        perms: { rest: { providers: ["read"], rosters: ["read", "submit"] } },
        active: true, lastUsed: daysAgo(0), expires: null },
      { name: "Legacy PARCS Bridge — DEPRECATED",
        perms: { rest: { providers: ["read"] } },
        active: false, lastUsed: daysAgo(45), expires: daysAgo(10) },
    ];
    for (const k of keys) {
      const raw = crypto.randomBytes(32).toString("hex");
      const hash = crypto.createHash("sha256").update(raw).digest("hex");
      await prisma.apiKey.create({
        data: { name: k.name, keyHash: hash, permissions: k.perms,
          isActive: k.active, lastUsedAt: k.lastUsed, createdBy: admin.id,
          expiresAt: k.expires },
      });
    }
    console.log(`  ✓ api_keys: ${keys.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 17. Saved reports
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.savedReport.count()) === 0) {
    const reports = [
      { name: "All providers — by status", category: "operations",
        filters: { groupBy: "status" }, columns: ["legalName", "status", "specialty", "assignedTo"] },
      { name: "Expirables due in next 60 days", category: "expirables",
        filters: { dueWithinDays: 60, status: ["EXPIRING_SOON", "CURRENT"] },
        columns: ["provider", "expirableType", "expirationDate", "lastVerifiedDate"] },
      { name: "Committee throughput — last 90 days", category: "committee",
        filters: { fromDate: daysAgo(90), status: ["APPROVED", "DENIED", "DEFERRED"] },
        columns: ["sessionDate", "decisionsCount", "approvedCount", "averageReviewMinutes"] },
      { name: "PSV bot success rate by source", category: "bots",
        filters: { groupBy: "botType", windowDays: 30 },
        columns: ["botType", "totalRuns", "successCount", "failureCount", "successRate"] },
      { name: "Outstanding sanctions / NPDB acks", category: "compliance",
        filters: { acknowledged: false, fromDate: daysAgo(60) },
        columns: ["provider", "source", "result", "runDate", "ageDays"] },
    ];
    for (const r of reports) {
      await prisma.savedReport.create({
        data: { name: r.name, category: r.category, filters: r.filters,
          columns: r.columns, createdById: admin.id },
      });
    }
    console.log(`  ✓ saved_reports: ${reports.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 18. NCQA criteria + assessments + snapshots
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.ncqaCriterion.count()) === 0) {
    const criteria = [
      { code: "CR-1.A",  cat: NcqaCategory.CREDENTIALING,
        title: "Primary source license verification",
        desc: "Verify each practitioner's license to practice through the issuing state board, dated within 180 days of credentialing decision." },
      { code: "CR-1.B",  cat: NcqaCategory.CREDENTIALING,
        title: "DEA certificate verification",
        desc: "Verify DEA registration, including schedules and expiration date." },
      { code: "CR-1.C",  cat: NcqaCategory.CREDENTIALING,
        title: "Board certification verification",
        desc: "Verify board certification (when claimed) directly from the certifying board." },
      { code: "CR-1.D",  cat: NcqaCategory.CREDENTIALING,
        title: "Education and training verification",
        desc: "Verify education (medical school) and post-graduate training (residency, fellowship)." },
      { code: "CR-1.E",  cat: NcqaCategory.CREDENTIALING,
        title: "Work history",
        desc: "Verify a minimum of 5 years of work history; document gaps > 6 months." },
      { code: "CR-2.A",  cat: NcqaCategory.CREDENTIALING,
        title: "NPDB query",
        desc: "Query the National Practitioner Data Bank at credentialing and at recredentialing." },
      { code: "CR-2.B",  cat: NcqaCategory.CREDENTIALING,
        title: "Sanctions / exclusions checks",
        desc: "Check OIG, SAM.gov, and state Medicaid exclusion lists at credentialing and at least monthly thereafter." },
      { code: "RC-1.A",  cat: NcqaCategory.RECREDENTIALING,
        title: "Recredentialing every 36 months",
        desc: "Recredential each practitioner at least every 36 months from the last credentialing decision." },
      { code: "RC-1.B",  cat: NcqaCategory.RECREDENTIALING,
        title: "Performance data review at recredentialing",
        desc: "Include OPPE / quality data, complaints, and adverse events in the recredentialing decision." },
      { code: "DG-1.A",  cat: NcqaCategory.DELEGATION,
        title: "Delegated CVO oversight",
        desc: "Maintain a written delegation agreement and conduct annual oversight." },
      { code: "PR-1.A",  cat: NcqaCategory.PRACTITIONER_RIGHTS,
        title: "Right to review information",
        desc: "Notify practitioners of their right to review information collected during credentialing." },
      { code: "PR-1.B",  cat: NcqaCategory.PRACTITIONER_RIGHTS,
        title: "Right to correct erroneous information",
        desc: "Provide a process for practitioners to correct erroneous information." },
      { code: "CF-1.A",  cat: NcqaCategory.CONFIDENTIALITY,
        title: "Credentialing file confidentiality",
        desc: "Limit access to credentialing files to authorized personnel only." },
      { code: "QM-1.A",  cat: NcqaCategory.QUALITY_MANAGEMENT,
        title: "Continuous monitoring",
        desc: "Monitor sanctions and license status between credentialing cycles." },
    ];
    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i]!;
      const criterion = await prisma.ncqaCriterion.create({
        data: { code: c.code, category: c.cat, title: c.title, description: c.desc,
          evidenceRequired: "PSV record, query log, or written attestation in provider file.",
          weight: 1, sortOrder: i, isActive: true },
      });
      const r = Math.random();
      const status = r < 0.7 ? NcqaAssessmentStatus.COMPLIANT
                   : r < 0.85 ? NcqaAssessmentStatus.PARTIAL
                   : r < 0.95 ? NcqaAssessmentStatus.NON_COMPLIANT
                   :            NcqaAssessmentStatus.NOT_ASSESSED;
      await prisma.ncqaCriterionAssessment.create({
        data: { criterionId: criterion.id, periodStart: monthsAgo(3),
          periodEnd: new Date(), status,
          score: status === NcqaAssessmentStatus.COMPLIANT ? 100
            : status === NcqaAssessmentStatus.PARTIAL ? 65 : 0,
          evidence: { sources: ["PSV log", "Bot run audit"], samplesReviewed: 10 },
          notes: status === NcqaAssessmentStatus.PARTIAL
            ? "2 of 10 sampled charts missed timely re-verification." : null,
          assessedById: lisa.id, assessedAt: daysAgo(7) },
      });
    }
    console.log(`  ✓ ncqa_criteria + assessments: ${criteria.length} each`);
  }

  if ((await prisma.ncqaComplianceSnapshot.count()) === 0) {
    const snaps = [
      { taken: daysAgo(90), total: 14, c: 12, p: 1, n: 1, na: 0, score: 86 },
      { taken: daysAgo(45), total: 14, c: 12, p: 2, n: 0, na: 0, score: 89 },
      { taken: daysAgo(2),  total: 14, c: 13, p: 1, n: 0, na: 0, score: 96 },
    ];
    for (const s of snaps) {
      await prisma.ncqaComplianceSnapshot.create({
        data: { takenAt: s.taken, totalCriteria: s.total, compliantCount: s.c,
          partialCount: s.p, nonCompliantCount: s.n, notApplicableCount: s.na,
          overallScore: s.score, takenById: lisa.id,
          breakdown: { CREDENTIALING: 95, RECREDENTIALING: 100, DELEGATION: 80,
            QUALITY_MANAGEMENT: 100 } },
      });
    }
    console.log(`  ✓ ncqa_compliance_snapshots: ${snaps.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 19. Compliance audit periods + evidence + gaps
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.complianceAuditPeriod.count()) === 0) {
    await prisma.complianceAuditPeriod.createMany({
      data: [
        { framework: ComplianceFramework.HITRUST_R2,
          periodStart: monthsAgo(6), periodEnd: monthsFromNow(6),
          assessorOrg: "BlueVoyant", assessorName: "K. Rao",
          status: ComplianceAuditPeriodStatus.FIELDWORK,
          notes: "Mid-period; controls being reviewed iteratively." },
        { framework: ComplianceFramework.SOC2_TYPE_II,
          periodStart: monthsAgo(12), periodEnd: monthsAgo(0),
          assessorOrg: "A-LIGN", assessorName: "M. Patel",
          status: ComplianceAuditPeriodStatus.REPORTING,
          notes: "Type II observation period closed; report drafting." },
      ],
    });
    console.log("  ✓ compliance_audit_periods: 2");
  }

  const controls = await prisma.complianceControl.findMany({ take: 8 });
  if ((await prisma.complianceEvidence.count()) === 0 && controls.length > 0) {
    for (const c of controls) {
      await prisma.complianceEvidence.create({
        data: { controlId: c.id, type: ComplianceEvidenceType.POLICY,
          title: `Written policy — ${c.title}`,
          description: "Approved policy document with version + sign-off.",
          url: "https://essenmed.sharepoint.example/policies/",
          periodStart: monthsAgo(6), periodEnd: monthsFromNow(6),
          addedById: lisa.id },
      });
    }
    console.log(`  ✓ compliance_evidence: ${controls.length}`);
  }

  if ((await prisma.complianceGap.count()) === 0 && controls.length > 0) {
    const gapData = [
      { sev: ComplianceGapSeverity.HIGH, status: ComplianceGapStatus.IN_REMEDIATION,
        desc: "Third-party SOC 2 reports for two sub-processors are > 12 months old." },
      { sev: ComplianceGapSeverity.MODERATE, status: ComplianceGapStatus.OPEN,
        desc: "Quarterly access review backlog: Q1 review not yet completed." },
      { sev: ComplianceGapSeverity.LOW, status: ComplianceGapStatus.PENDING_VALIDATION,
        desc: "Disaster Recovery test cadence documented but tabletop not yet exercised." },
      { sev: ComplianceGapSeverity.CRITICAL, status: ComplianceGapStatus.OPEN,
        desc: "AUDIT_HMAC_KEY rotation procedure not yet operationalized." },
    ];
    for (let i = 0; i < gapData.length; i++) {
      const g = gapData[i]!;
      const c = controls[i % controls.length]!;
      await prisma.complianceGap.create({
        data: { controlId: c.id, description: g.desc, severity: g.sev, status: g.status,
          ownerUserId: lisa.id, dueDate: daysFromNow(30 + i * 15),
          remediation: "Action plan documented in JIRA; quarterly progress to compliance committee." },
      });
    }
    console.log(`  ✓ compliance_gaps: ${gapData.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 20. Peer review meetings + minutes
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.peerReviewMeeting.count()) === 0) {
    const past = await prisma.peerReviewMeeting.create({
      data: { meetingDate: daysAgo(30), facilityName: "Essen Main – Bronx",
        chairId: drPatel.id, status: PeerReviewMeetingStatus.COMPLETED,
        attendees: [
          { userId: drPatel.id, name: "Dr. Anita Patel" },
          { userId: drWilliams.id, name: "Dr. Charles Williams" },
          { userId: lisa.id, name: "Lisa Rodriguez" },
        ],
        notes: "All 3 cases reviewed. No adverse outcomes." } });
    const upcoming = await prisma.peerReviewMeeting.create({
      data: { meetingDate: daysFromNow(14), facilityName: "Essen – Yonkers",
        chairId: drWilliams.id, status: PeerReviewMeetingStatus.SCHEDULED,
        attendees: [
          { userId: drPatel.id, name: "Dr. Anita Patel" },
          { userId: drWilliams.id, name: "Dr. Charles Williams" },
        ] } });
    const inProgress = await prisma.peerReviewMeeting.create({
      data: { meetingDate: new Date(), facilityName: "Video — MS Teams",
        chairId: drPatel.id, status: PeerReviewMeetingStatus.IN_PROGRESS,
        attendees: [{ userId: drPatel.id, name: "Dr. Anita Patel" }] } });
    console.log("  ✓ peer_review_meetings: 3");

    await prisma.peerReviewMinute.createMany({
      data: [
        { meetingId: past.id, providerId: kim.id,
          caseSummary: "Routine outpatient med review — patient stable.",
          caseDate: daysAgo(45), outcome: PeerReviewMinuteOutcome.NO_ACTION,
          rationale: "Clinical decision-making appropriate.",
          authoredById: drPatel.id },
        { meetingId: past.id, providerId: davis.id,
          caseSummary: "ED handoff documentation incomplete on one chart.",
          caseDate: daysAgo(50), outcome: PeerReviewMinuteOutcome.CONTINUED_REVIEW,
          rationale: "One-off; track 90-day trend.", followUpRequired: true,
          followUpDueDate: daysFromNow(60), authoredById: drPatel.id },
        { meetingId: past.id, providerId: thompson.id,
          caseSummary: "New geriatric psych admission pattern review.",
          caseDate: daysAgo(40), outcome: PeerReviewMinuteOutcome.FOCUSED_REVIEW_REQUIRED,
          rationale: "Trigger FPPE for first 10 admissions.", followUpRequired: true,
          followUpDueDate: daysFromNow(90), authoredById: drWilliams.id },
        { meetingId: upcoming.id, providerId: santos.id,
          caseSummary: "Pre-committee review of Maria Santos.",
          outcome: PeerReviewMinuteOutcome.NO_ACTION,
          authoredById: drWilliams.id },
        { meetingId: inProgress.id, providerId: harrison.id,
          caseSummary: "Initial appointment review.",
          outcome: PeerReviewMinuteOutcome.NO_ACTION,
          authoredById: drPatel.id },
      ],
    });
    console.log("  ✓ peer_review_minutes: 5");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 21. FSMB PDC subscriptions + events (only MD/DO get FSMB)
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.fsmbPdcSubscription.count()) === 0) {
    const fsmbProviders = [harrison, kim, mitchell, thompson];
    for (const p of fsmbProviders) {
      await prisma.fsmbPdcSubscription.create({
        data: { providerId: p.id, fsmbId: `FSMB-${Math.floor(Math.random() * 9000000) + 1000000}`,
          status: FsmbPdcSubscriptionStatus.ACTIVE,
          enrolledAt: monthsAgo(6), lastSyncedAt: daysAgo(1),
          lastEventReceivedAt: daysAgo(3) },
      });
    }
    console.log(`  ✓ fsmb_pdc_subscriptions: ${fsmbProviders.length}`);

    await prisma.fsmbPdcEvent.createMany({
      data: [
        { providerId: harrison.id, eventType: FsmbPdcEventType.LICENSE_STATUS_CHANGE,
          severity: FsmbPdcEventSeverity.WARNING, occurredAt: daysAgo(3),
          state: "NY", summary: "Status changed: ACTIVE → UNDER_REVIEW",
          rawPayload: { board: "NY OPMC", oldStatus: "ACTIVE", newStatus: "UNDER_REVIEW" },
          processingStatus: FsmbPdcEventProcessingStatus.PROCESSED },
        { providerId: kim.id, eventType: FsmbPdcEventType.DEMOGRAPHIC_UPDATE,
          severity: FsmbPdcEventSeverity.INFO, occurredAt: daysAgo(10),
          state: "NJ", summary: "Address update on file",
          rawPayload: { field: "primary_practice_address" },
          processingStatus: FsmbPdcEventProcessingStatus.PROCESSED },
        { providerId: mitchell.id, eventType: FsmbPdcEventType.BOARD_ACTION,
          severity: FsmbPdcEventSeverity.CRITICAL, occurredAt: daysAgo(20),
          state: "NY", summary: "Board entered censure",
          rawPayload: { actionType: "Censure", actionDate: daysAgo(20).toISOString() },
          processingStatus: FsmbPdcEventProcessingStatus.PROCESSED },
        { providerId: thompson.id, eventType: FsmbPdcEventType.EDUCATION_UPDATE,
          severity: FsmbPdcEventSeverity.INFO, occurredAt: daysAgo(15),
          summary: "Fellowship completion verified",
          rawPayload: { fellowship: "Geriatric Psychiatry", year: 2024 },
          processingStatus: FsmbPdcEventProcessingStatus.PROCESSED },
        { providerId: harrison.id, eventType: FsmbPdcEventType.OTHER,
          severity: FsmbPdcEventSeverity.INFO, occurredAt: daysAgo(1),
          summary: "Routine sync event",
          rawPayload: { syncId: crypto.randomUUID() },
          processingStatus: FsmbPdcEventProcessingStatus.RECEIVED },
        { providerId: kim.id, eventType: FsmbPdcEventType.LICENSE_STATUS_CHANGE,
          severity: FsmbPdcEventSeverity.INFO, occurredAt: daysAgo(2),
          state: "NY", summary: "Renewal confirmed",
          rawPayload: { newExpiration: daysFromNow(700).toISOString() },
          processingStatus: FsmbPdcEventProcessingStatus.PROCESSED },
      ],
    });
    console.log("  ✓ fsmb_pdc_events: 6");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 22. Medicaid enrollments + enrollment follow-ups
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.medicaidEnrollment.count()) === 0) {
    const medicaidData = [
      { provider: kim,      sub: MedicaidEnrollmentSubtype.INDIVIDUAL,
        path: MedicaidEnrollmentPath.NEW_PSP, payer: "NY Medicaid",
        status: MedicaidAffiliationStatus.ENROLLED, etin: "12345" },
      { provider: santos,   sub: MedicaidEnrollmentSubtype.INDIVIDUAL,
        path: MedicaidEnrollmentPath.NEW_PSP, payer: "NY Medicaid",
        status: MedicaidAffiliationStatus.IN_PROCESS, etin: null },
      { provider: davis,    sub: MedicaidEnrollmentSubtype.INDIVIDUAL,
        path: MedicaidEnrollmentPath.NEW_PSP, payer: "NY Medicaid",
        status: MedicaidAffiliationStatus.ENROLLED, etin: "67890" },
      { provider: thompson, sub: MedicaidEnrollmentSubtype.INDIVIDUAL,
        path: MedicaidEnrollmentPath.AFFILIATION_UPDATE, payer: "NY Medicaid",
        status: MedicaidAffiliationStatus.PENDING, etin: null },
      { provider: mitchell, sub: MedicaidEnrollmentSubtype.INDIVIDUAL,
        path: MedicaidEnrollmentPath.REINSTATEMENT, payer: "NY Medicaid",
        status: MedicaidAffiliationStatus.REVALIDATION_DUE, etin: "11223" },
      { provider: harrison, sub: MedicaidEnrollmentSubtype.GROUP,
        path: MedicaidEnrollmentPath.NEW_PSP, payer: "NJ Medicaid",
        status: MedicaidAffiliationStatus.IN_PROCESS, etin: null },
    ];
    for (const m of medicaidData) {
      await prisma.medicaidEnrollment.create({
        data: { providerId: m.provider.id, enrollmentSubtype: m.sub,
          enrollmentPath: m.path, payer: m.payer, etinNumber: m.etin,
          affiliationStatus: m.status,
          providerSignatureRequired: true,
          providerSignatureReceivedAt: m.status === MedicaidAffiliationStatus.ENROLLED ? daysAgo(60) : null,
          submissionDate: m.status === MedicaidAffiliationStatus.ENROLLED ? daysAgo(50) : null,
          enrollmentEffectiveDate: m.status === MedicaidAffiliationStatus.ENROLLED ? daysAgo(45) : null,
          revalidationDueDate: m.status === MedicaidAffiliationStatus.REVALIDATION_DUE ? daysFromNow(30) : null,
          createdById: sarah.id },
      });
    }
    console.log(`  ✓ medicaid_enrollments: ${medicaidData.length}`);
  }

  const enrollments = await prisma.enrollment.findMany({ take: 4 });
  if ((await prisma.enrollmentFollowUp.count()) === 0 && enrollments.length > 0) {
    const outcomes = [
      "Called payer rep — confirmed application in queue.",
      "Email sent requesting status update; awaiting reply.",
      "Provider data corrected per payer feedback (specialty taxonomy).",
      "Escalated to delegation manager per SLA.",
    ];
    for (let i = 0; i < enrollments.length; i++) {
      await prisma.enrollmentFollowUp.create({
        data: { enrollmentId: enrollments[i]!.id, followUpDate: daysAgo(i * 3 + 1),
          performedById: i % 2 === 0 ? sarah.id : michael.id,
          outcome: outcomes[i % outcomes.length]!,
          nextFollowUpDate: daysFromNow(7) },
      });
    }
    console.log(`  ✓ enrollment_follow_ups: ${enrollments.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 23. FHIR Directory: locations + endpoints + practitioner roles
  // ─────────────────────────────────────────────────────────────────────────
  let org = await prisma.directoryOrganization.findFirst();
  if (!org) {
    org = await prisma.directoryOrganization.create({
      data: { name: "Essen Medical Group", type: "PROV", npi: "1235576890",
        active: true, phone: "(718) 555-0100", website: "https://essenmed.com" } });
  }

  if ((await prisma.directoryLocation.count()) === 0) {
    await prisma.directoryLocation.createMany({
      data: [
        { name: "Essen Main – Bronx", street: "1894 Eastchester Rd",
          city: "Bronx", state: "NY", postalCode: "10461",
          phone: "(718) 555-0100", managingOrgId: org.id, status: "active" },
        { name: "Essen – Yonkers", street: "234 South Broadway",
          city: "Yonkers", state: "NY", postalCode: "10705",
          phone: "(914) 555-0102", managingOrgId: org.id, status: "active" },
        { name: "Essen BTC – Staten Island", street: "555 Bay St",
          city: "Staten Island", state: "NY", postalCode: "10304",
          phone: "(718) 555-0103", managingOrgId: org.id, status: "active" },
      ],
    });
    console.log("  ✓ directory_locations: 3");
  }

  if ((await prisma.directoryEndpoint.count()) === 0) {
    await prisma.directoryEndpoint.createMany({
      data: [
        { name: "Essen FHIR R4 base", connectionType: DirectoryEndpointType.FHIR_BASE,
          payloadType: "application/fhir+json",
          address: "https://credentialing.hdpulseai.com/api/fhir",
          managingOrgId: org.id, status: "active" },
        { name: "Direct Secure Messaging — referrals",
          connectionType: DirectoryEndpointType.DIRECT_SECURE_MESSAGING,
          payloadType: "X-DM-Direct",
          address: "mailto:essen-direct@directaddress.example",
          managingOrgId: org.id, status: "active" },
      ],
    });
    console.log("  ✓ directory_endpoints: 2");
  }

  const locations = await prisma.directoryLocation.findMany();
  if ((await prisma.directoryPractitionerRole.count()) === 0 && locations.length > 0) {
    const roleProviders = [harrison, santos, kim, walsh, thompson, davis];
    for (let i = 0; i < roleProviders.length; i++) {
      const p = roleProviders[i]!;
      await prisma.directoryPractitionerRole.create({
        data: { providerId: p.id, organizationId: org.id,
          locationId: locations[i % locations.length]!.id,
          active: true, specialty: ["Internal Medicine", "Psychiatry", "Family Medicine"][i % 3],
          startDate: daysAgo(60), acceptingNewPatients: i % 2 === 0 },
      });
    }
    console.log(`  ✓ directory_practitioner_roles: ${roleProviders.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 24. Task comments
  // ─────────────────────────────────────────────────────────────────────────
  const tasks = await prisma.task.findMany({ take: 6 });
  if ((await prisma.taskComment.count()) === 0 && tasks.length > 0) {
    const commentBodies = [
      "Reached out to provider via email and SMS — awaiting response.",
      "Verified with payer rep that submission was received but is in additional review.",
      "Document uploaded by provider; verification queued.",
      "Escalated to manager — outside SLA window.",
      "Closed loop; provider confirmed receipt and next steps.",
      "PSV bot retried successfully on second attempt.",
    ];
    for (let i = 0; i < tasks.length; i++) {
      await prisma.taskComment.create({
        data: { taskId: tasks[i]!.id, authorId: i % 2 === 0 ? sarah.id : michael.id,
          body: commentBodies[i]!, mentionedUserIds: [] },
      });
    }
    console.log(`  ✓ task_comments: ${tasks.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 25. Documents (uploaded credential documents)
  // ─────────────────────────────────────────────────────────────────────────
  if ((await prisma.document.count()) === 0) {
    const docTargets = [
      { p: harrison, dt: DocumentType.DEA_CERTIFICATE,         name: "DEA Certificate.pdf" },
      { p: harrison, dt: DocumentType.CV_RESUME,               name: "CV — James Harrison.pdf" },
      { p: santos,   dt: DocumentType.MEDICAL_SCHOOL_DIPLOMA,  name: "Medical School Diploma.pdf" },
      { p: santos,   dt: DocumentType.BLS_CARD,                name: "BLS Card.jpg" },
      { p: kim,      dt: DocumentType.BOARD_CERTIFICATION,     name: "ABPN Board Certification.pdf" },
      { p: kim,      dt: DocumentType.PROFESSIONAL_LIABILITY_INSURANCE, name: "Malpractice COI.pdf" },
      { p: walsh,    dt: DocumentType.GRADUATE_CERTIFICATE,    name: "MSN Diploma.pdf" },
      { p: thompson, dt: DocumentType.RESIDENCY_CERTIFICATE,   name: "Residency Certificate.pdf" },
    ];
    for (const d of docTargets) {
      await prisma.document.create({
        data: {
          providerId: d.p.id, documentType: d.dt, originalFilename: d.name,
          blobUrl: `https://stub.blob.local/providers/${d.p.id}/documents/${d.name}`,
          blobContainer: "providers",
          blobPath: `providers/${d.p.id}/documents/${d.name}`,
          fileSizeBytes: 200000 + Math.floor(Math.random() * 800000),
          mimeType: d.name.endsWith(".jpg") ? "image/jpeg" : "application/pdf",
          uploadedById: sarah.id, uploaderType: "STAFF",
          source: DocumentSource.PROVIDER_UPLOAD,
          ocrStatus: OcrStatus.COMPLETED,
          ocrConfidence: 0.95,
          isVerified: true,
          suggestedDocumentType: d.dt,
          classifierConfidence: 0.97,
          classifierVersion: "azure-doc-intel-2024-07-31",
        },
      });
    }
    console.log(`  ✓ documents: ${docTargets.length}`);
  }

  console.log("\nSeed-extras complete.");
}

main()
  .catch((e) => { console.error("seed-extras error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
