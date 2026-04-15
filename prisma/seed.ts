import {
  PrismaClient,
  DocumentType,
  RequirementType,
  UserRole,
  ProviderStatus,
  LicenseStatus,
  LicenseSource,
  ChecklistStatus,
  TaskPriority,
  TaskStatus,
  CommunicationType,
  CommunicationDirection,
  CommunicationChannel,
  DeliveryStatus,
  BotType,
  BotStatus,
  BotTriggeredBy,
  CredentialType,
  VerificationStatus,
  CommitteeSessionStatus,
  CommitteeDecision,
  EnrollmentType,
  EnrollmentStatus,
  SubmissionMethod,
  ExpirableType,
  ExpirableStatus,
  SanctionsSource,
  SanctionsTriggeredBy,
  SanctionsResult,
  NpdbQueryType,
  NpdbResult,
  HospitalPrivilegeStatus,
  DocumentSource,
  OcrStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86400000);
}

async function main() {
  console.log("Seeding provider types and document requirements...");

  // ─── Provider Types ────────────────────────────────────────────────────────

  const providerTypeData = [
    { name: "Physician", abbreviation: "MD", requiresEcfmg: false, requiresDea: true, requiresBoards: true, boardType: "ABIM/ABFM/other", isActive: true },
    { name: "Doctor of Osteopathic Medicine", abbreviation: "DO", requiresEcfmg: false, requiresDea: true, requiresBoards: true, boardType: "AOA/ABMS", isActive: true },
    { name: "Physician Assistant", abbreviation: "PA", requiresEcfmg: false, requiresDea: false, requiresBoards: true, boardType: "NCCPA", isActive: true },
    { name: "Nurse Practitioner", abbreviation: "NP", requiresEcfmg: false, requiresDea: false, requiresBoards: true, boardType: "ANCC/AANP", isActive: true },
    { name: "Licensed Clinical Social Worker", abbreviation: "LCSW", requiresEcfmg: false, requiresDea: false, requiresBoards: false, boardType: null, isActive: true },
    { name: "Licensed Mental Health Counselor", abbreviation: "LMHC", requiresEcfmg: false, requiresDea: false, requiresBoards: false, boardType: null, isActive: true },
  ];

  const createdTypes: Record<string, string> = {};
  for (const pt of providerTypeData) {
    const created = await prisma.providerType.upsert({
      where: { abbreviation: pt.abbreviation },
      update: pt,
      create: pt,
    });
    createdTypes[pt.abbreviation] = created.id;
    console.log(`  ✓ Provider type: ${pt.abbreviation} (${pt.name})`);
  }

  // ─── Document Requirements ─────────────────────────────────────────────────

  const commonRequired: DocumentType[] = [
    DocumentType.PHOTO_ID, DocumentType.CV_RESUME, DocumentType.PROFESSIONAL_LIABILITY_INSURANCE,
    DocumentType.ORIGINAL_LICENSE, DocumentType.BLS_CARD, DocumentType.INFECTION_CONTROL_CERTIFICATE,
    DocumentType.CHILD_ABUSE_CERTIFICATE, DocumentType.PHYSICAL_EXAM_MMR, DocumentType.PHYSICAL_EXAM_PPD,
    DocumentType.FLU_SHOT,
  ];

  const mdRequirements = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.MEDICAL_SCHOOL_DIPLOMA, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.RESIDENCY_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.ECFMG_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for international medical graduates" },
    { documentType: DocumentType.INTERNSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if internship completed separately from residency" },
    { documentType: DocumentType.FELLOWSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if fellowship training completed" },
    { documentType: DocumentType.HOSPITAL_APPOINTMENT_LETTER, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if hospital privileges requested" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
    { documentType: DocumentType.SSN_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if SSN not previously on file" },
  ];
  const doRequirements = mdRequirements.map((r) => ({ ...r }));
  const paRequirements = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.MEDICAL_SCHOOL_DIPLOMA, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if provider will prescribe controlled substances" },
    { documentType: DocumentType.FELLOWSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if fellowship completed" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for procedural PAs" },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
  ];
  const npRequirements = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if provider will prescribe controlled substances" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for acute care NPs" },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
  ];
  const lcswRequirements = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.CME_CREDITS, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for license renewal documentation" },
  ];
  const lmhcRequirements = lcswRequirements.map((r) => ({ ...r }));

  const requirementsByType: Record<string, Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }>> = {
    MD: mdRequirements, DO: doRequirements, PA: paRequirements, NP: npRequirements, LCSW: lcswRequirements, LMHC: lmhcRequirements,
  };

  for (const [abbrev, requirements] of Object.entries(requirementsByType)) {
    const providerTypeId = createdTypes[abbrev];
    if (!providerTypeId) continue;
    for (const req of requirements) {
      await prisma.documentRequirement.upsert({
        where: { providerTypeId_documentType: { providerTypeId, documentType: req.documentType } },
        update: { requirement: req.requirement, conditionDescription: req.conditionDescription ?? null },
        create: { providerTypeId, documentType: req.documentType, requirement: req.requirement, conditionDescription: req.conditionDescription ?? null },
      });
    }
    console.log(`  ✓ Document requirements for ${abbrev}: ${requirements.length} records`);
  }

  // ─── Admin User ────────────────────────────────────────────────────────────

  const adminPasswordHash = await bcrypt.hash("Users1!@#$%^", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hdpulseai.com" },
    update: { passwordHash: adminPasswordHash, displayName: "System Administrator", role: UserRole.ADMIN, isActive: true },
    create: { email: "admin@hdpulseai.com", displayName: "System Administrator", passwordHash: adminPasswordHash, role: UserRole.ADMIN, isActive: true },
  });
  console.log(`  ✓ Admin user: ${adminUser.email}`);

  // ─── Skip demo data if providers already exist ─────────────────────────────

  const existingProviderCount = await prisma.provider.count();
  if (existingProviderCount > 0) {
    console.log(`\n  ℹ  ${existingProviderCount} providers already exist — skipping demo data.`);
    console.log("\nSeed complete.");
    return;
  }

  console.log("\nSeeding demo data...");

  // ─── Staff Users ───────────────────────────────────────────────────────────

  const staffPassword = await bcrypt.hash("Staff1!@#", 12);

  const sarah = await prisma.user.upsert({
    where: { email: "sarah.johnson@essenmed.com" },
    update: {},
    create: { email: "sarah.johnson@essenmed.com", displayName: "Sarah Johnson", passwordHash: staffPassword, role: UserRole.SPECIALIST, isActive: true },
  });
  const michael = await prisma.user.upsert({
    where: { email: "michael.chen@essenmed.com" },
    update: {},
    create: { email: "michael.chen@essenmed.com", displayName: "Michael Chen", passwordHash: staffPassword, role: UserRole.SPECIALIST, isActive: true },
  });
  const lisa = await prisma.user.upsert({
    where: { email: "lisa.rodriguez@essenmed.com" },
    update: {},
    create: { email: "lisa.rodriguez@essenmed.com", displayName: "Lisa Rodriguez", passwordHash: staffPassword, role: UserRole.MANAGER, isActive: true },
  });
  const drPatel = await prisma.user.upsert({
    where: { email: "dr.patel@essenmed.com" },
    update: {},
    create: { email: "dr.patel@essenmed.com", displayName: "Dr. Anita Patel", passwordHash: staffPassword, role: UserRole.COMMITTEE_MEMBER, isActive: true },
  });
  const drWilliams = await prisma.user.upsert({
    where: { email: "dr.williams@essenmed.com" },
    update: {},
    create: { email: "dr.williams@essenmed.com", displayName: "Dr. Charles Williams", passwordHash: staffPassword, role: UserRole.COMMITTEE_MEMBER, isActive: true },
  });

  console.log("  ✓ Staff users: 5 created");

  // ─── Providers ─────────────────────────────────────────────────────────────

  const providerDefs = [
    {
      legalFirstName: "James", legalLastName: "Harrison", abbrev: "MD",
      npi: "1234567891", status: ProviderStatus.VERIFICATION_IN_PROGRESS,
      specialty: "Internal Medicine", facility: "Essen Main – Bronx",
      deaNumber: "BH1234563", caqhId: "12345678",
      applicationSubmittedAt: daysAgo(35), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Maria", legalLastName: "Santos", abbrev: "DO",
      npi: "1234567892", status: ProviderStatus.COMMITTEE_READY,
      specialty: "Family Medicine", facility: "Essen – Yonkers",
      deaNumber: "BS9876541", caqhId: "87654321",
      applicationSubmittedAt: daysAgo(55), committeeReadyAt: daysAgo(5), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Robert", legalLastName: "Kim", abbrev: "MD",
      npi: "1234567893", status: ProviderStatus.APPROVED,
      specialty: "Psychiatry", facility: "Essen BTC – Staten Island",
      deaNumber: "BK4567892", caqhId: "11223344",
      applicationSubmittedAt: daysAgo(90), approvedAt: daysAgo(10), assignedTo: michael.id,
    },
    {
      legalFirstName: "Jennifer", legalLastName: "Walsh", abbrev: "NP",
      npi: "1234567894", status: ProviderStatus.DOCUMENTS_PENDING,
      specialty: "Psychiatric NP", facility: "Essen Main – Bronx",
      applicationSubmittedAt: daysAgo(14), assignedTo: michael.id,
    },
    {
      legalFirstName: "Anthony", legalLastName: "Russo", abbrev: "MD",
      npi: "1234567895", status: ProviderStatus.ONBOARDING_IN_PROGRESS,
      specialty: "Addiction Medicine", facility: "Essen – Brooklyn",
      assignedTo: sarah.id,
    },
    {
      legalFirstName: "Carlos", legalLastName: "Mendez", abbrev: "LCSW",
      npi: "1234567896", status: ProviderStatus.VERIFICATION_IN_PROGRESS,
      specialty: "Clinical Social Work", facility: "Essen – Yonkers",
      applicationSubmittedAt: daysAgo(28), assignedTo: michael.id,
    },
    {
      legalFirstName: "Emily", legalLastName: "Thompson", abbrev: "MD",
      npi: "1234567897", status: ProviderStatus.COMMITTEE_IN_REVIEW,
      specialty: "Geriatric Psychiatry", facility: "Essen Main – Bronx",
      deaNumber: "BT3456781", caqhId: "55667788",
      applicationSubmittedAt: daysAgo(70), committeeReadyAt: daysAgo(12), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Patricia", legalLastName: "Davis", abbrev: "PA",
      npi: "1234567898", status: ProviderStatus.APPROVED,
      specialty: "Behavioral Health PA", facility: "Essen – Brooklyn",
      applicationSubmittedAt: daysAgo(110), approvedAt: daysAgo(30), assignedTo: michael.id,
    },
    {
      legalFirstName: "William", legalLastName: "Park", abbrev: "DO",
      npi: "1234567899", status: ProviderStatus.INVITED,
      specialty: "Family Psychiatry", facility: "Essen – Staten Island",
      inviteSentAt: daysAgo(3), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Sophia", legalLastName: "Chen", abbrev: "NP",
      npi: "1234567900", status: ProviderStatus.DOCUMENTS_PENDING,
      specialty: "Adult Psychiatric NP", facility: "Essen – Yonkers",
      applicationSubmittedAt: daysAgo(8), assignedTo: michael.id,
    },
    {
      legalFirstName: "Marcus", legalLastName: "Johnson", abbrev: "MD",
      npi: "1234567901", status: ProviderStatus.COMMITTEE_READY,
      specialty: "Child Psychiatry", facility: "Essen BTC – Bronx",
      deaNumber: "BJ7654321", caqhId: "99887766",
      applicationSubmittedAt: daysAgo(60), committeeReadyAt: daysAgo(2), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Angela", legalLastName: "Rivera", abbrev: "LMHC",
      npi: "1234567902", status: ProviderStatus.ONBOARDING_IN_PROGRESS,
      specialty: "Mental Health Counseling", facility: "Essen – Brooklyn",
      assignedTo: michael.id,
    },
    {
      legalFirstName: "David", legalLastName: "Mitchell", abbrev: "MD",
      npi: "1234567903", status: ProviderStatus.APPROVED,
      specialty: "Internal Medicine", facility: "Essen Main – Bronx",
      deaNumber: "BM2345678", caqhId: "44556677",
      applicationSubmittedAt: daysAgo(130), approvedAt: daysAgo(45), assignedTo: sarah.id,
    },
    {
      legalFirstName: "Rachel", legalLastName: "Kim", abbrev: "PA",
      npi: "1234567904", status: ProviderStatus.VERIFICATION_IN_PROGRESS,
      specialty: "Psychiatric PA", facility: "Essen – Yonkers",
      applicationSubmittedAt: daysAgo(40), assignedTo: michael.id,
    },
  ];

  const createdProviders: { id: string; legalFirstName: string; legalLastName: string; abbrev: string; status: ProviderStatus; assignedTo: string }[] = [];

  for (const def of providerDefs) {
    const typeId = createdTypes[def.abbrev]!;
    const provider = await prisma.provider.create({
      data: {
        legalFirstName: def.legalFirstName,
        legalLastName: def.legalLastName,
        status: def.status,
        providerTypeId: typeId,
        assignedSpecialistId: def.assignedTo,
        npi: def.npi,
        deaNumber: def.deaNumber ?? null,
        caqhId: def.caqhId ?? null,
        inviteSentAt: def.inviteSentAt ?? null,
        applicationStartedAt: def.applicationSubmittedAt ? new Date(def.applicationSubmittedAt.getTime() - 7 * 86400000) : null,
        applicationSubmittedAt: def.applicationSubmittedAt ?? null,
        committeeReadyAt: def.committeeReadyAt ?? null,
        approvedAt: def.approvedAt ?? null,
        approvedBy: def.approvedAt ? adminUser.id : null,
        createdById: adminUser.id,
        updatedById: def.assignedTo,
      },
    });

    // Profile
    await prisma.providerProfile.create({
      data: {
        providerId: provider.id,
        specialtyPrimary: def.specialty,
        facilityAssignment: def.facility,
        department: "Behavioral Health",
        jobTitle: def.abbrev === "MD" || def.abbrev === "DO" ? "Staff Physician" : def.abbrev === "NP" ? "Nurse Practitioner" : def.abbrev === "PA" ? "Physician Assistant" : "Clinician",
        hireDate: def.applicationSubmittedAt ? new Date(def.applicationSubmittedAt.getTime() - 30 * 86400000) : null,
        startDate: def.approvedAt ? new Date(def.approvedAt.getTime() + 14 * 86400000) : null,
        mobilePhone: `(917) 555-${String(1000 + createdProviders.length).slice(-4)}`,
        personalEmail: `${def.legalFirstName.toLowerCase()}.${def.legalLastName.toLowerCase()}@gmail.com`,
      },
    });

    createdProviders.push({ id: provider.id, legalFirstName: def.legalFirstName, legalLastName: def.legalLastName, abbrev: def.abbrev, status: def.status, assignedTo: def.assignedTo });
  }

  console.log(`  ✓ Providers: ${createdProviders.length} created`);

  // ─── Licenses ──────────────────────────────────────────────────────────────

  const licenseData = [
    { npi: "1234567891", state: "NY", licenseNumber: "287654", type: "Physician and Surgeon", exp: daysFromNow(365) },
    { npi: "1234567892", state: "NY", licenseNumber: "298765", type: "Osteopathic Physician", exp: daysFromNow(180) },
    { npi: "1234567893", state: "NY", licenseNumber: "276543", type: "Physician and Surgeon", exp: daysFromNow(500) },
    { npi: "1234567893", state: "NJ", licenseNumber: "MA123456", type: "Physician and Surgeon", exp: daysFromNow(400), primary: false },
    { npi: "1234567894", state: "NY", licenseNumber: "NP98765", type: "Nurse Practitioner", exp: daysFromNow(300) },
    { npi: "1234567895", state: "NY", licenseNumber: "265432", type: "Physician and Surgeon", exp: daysFromNow(600) },
    { npi: "1234567896", state: "NY", licenseNumber: "LCSW34567", type: "Licensed Clinical Social Worker", exp: daysFromNow(90) },
    { npi: "1234567897", state: "NY", licenseNumber: "254321", type: "Physician and Surgeon", exp: daysFromNow(450) },
    { npi: "1234567898", state: "NY", licenseNumber: "PA87654", type: "Physician Assistant", exp: daysFromNow(250) },
    { npi: "1234567899", state: "NY", licenseNumber: "DO23456", type: "Osteopathic Physician", exp: daysFromNow(700) },
    { npi: "1234567900", state: "NY", licenseNumber: "NP76543", type: "Nurse Practitioner", exp: daysFromNow(400) },
    { npi: "1234567901", state: "NY", licenseNumber: "243210", type: "Physician and Surgeon", exp: daysFromNow(320) },
    { npi: "1234567902", state: "NY", licenseNumber: "LMHC56789", type: "Licensed Mental Health Counselor", exp: daysFromNow(150) },
    { npi: "1234567903", state: "NY", licenseNumber: "232109", type: "Physician and Surgeon", exp: daysFromNow(600) },
    { npi: "1234567904", state: "NY", licenseNumber: "PA65432", type: "Physician Assistant", exp: daysFromNow(210) },
  ];

  for (const lic of licenseData) {
    const provider = createdProviders.find((p) =>
      providerDefs.find((d) => d.npi === lic.npi && d.legalFirstName === p.legalFirstName && d.legalLastName === p.legalLastName)
    );
    const providerRecord = await prisma.provider.findUnique({ where: { npi: lic.npi } });
    if (!providerRecord) continue;
    await prisma.license.create({
      data: {
        providerId: providerRecord.id,
        state: lic.state,
        licenseNumber: lic.licenseNumber,
        licenseType: lic.type,
        status: LicenseStatus.ACTIVE,
        issueDate: new Date(lic.exp.getTime() - 2 * 365 * 86400000),
        expirationDate: lic.exp,
        isPrimary: lic.primary !== false,
        source: LicenseSource.CAQH,
      },
    });
  }
  console.log(`  ✓ Licenses: ${licenseData.length} created`);

  // ─── Checklist Items ───────────────────────────────────────────────────────

  const checklistStatuses: Record<string, ChecklistStatus[]> = {
    APPROVED:                [ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED],
    COMMITTEE_READY:         [ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.PENDING],
    COMMITTEE_IN_REVIEW:     [ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.PENDING, ChecklistStatus.PENDING],
    VERIFICATION_IN_PROGRESS:[ChecklistStatus.RECEIVED, ChecklistStatus.RECEIVED, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING],
    DOCUMENTS_PENDING:       [ChecklistStatus.RECEIVED, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING],
    ONBOARDING_IN_PROGRESS:  [ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING],
    INVITED:                 [ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING, ChecklistStatus.PENDING],
  };

  const coreDocTypes = [
    DocumentType.PHOTO_ID, DocumentType.CV_RESUME, DocumentType.PROFESSIONAL_LIABILITY_INSURANCE,
    DocumentType.ORIGINAL_LICENSE, DocumentType.BLS_CARD,
  ];

  let checklistCount = 0;
  for (const p of createdProviders) {
    const statuses = checklistStatuses[p.status] ?? checklistStatuses.INVITED!;
    for (let i = 0; i < coreDocTypes.length; i++) {
      const docType = coreDocTypes[i]!;
      const status = statuses[i] ?? ChecklistStatus.PENDING;
      await prisma.checklistItem.create({
        data: {
          providerId: p.id,
          documentType: docType,
          status,
          receivedAt: status === ChecklistStatus.RECEIVED ? daysAgo(Math.floor(Math.random() * 20) + 5) : null,
        },
      });
      checklistCount++;
    }
  }
  console.log(`  ✓ Checklist items: ${checklistCount} created`);

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  const taskDefs = [
    { providerNpi: "1234567891", title: "Request DEA verification", description: "Run DEA bot for James Harrison — expires in 8 months", priority: TaskPriority.HIGH, status: TaskStatus.IN_PROGRESS, dueDate: daysFromNow(3), assignedTo: sarah.id },
    { providerNpi: "1234567892", title: "Prepare committee summary", description: "Generate and review committee summary sheet for Maria Santos", priority: TaskPriority.HIGH, status: TaskStatus.OPEN, dueDate: daysFromNow(1), assignedTo: sarah.id },
    { providerNpi: "1234567894", title: "Follow up on missing documents", description: "Contact Jennifer Walsh regarding missing BLS card and professional liability insurance", priority: TaskPriority.MEDIUM, status: TaskStatus.OPEN, dueDate: daysFromNow(2), assignedTo: michael.id },
    { providerNpi: "1234567895", title: "Send application invite", description: "Send onboarding link to Anthony Russo — iCIMS data ingested", priority: TaskPriority.MEDIUM, status: TaskStatus.OPEN, dueDate: daysFromNow(1), assignedTo: sarah.id },
    { providerNpi: "1234567896", title: "OIG sanctions check", description: "Run OIG and SAM.gov checks for Carlos Mendez", priority: TaskPriority.HIGH, status: TaskStatus.IN_PROGRESS, dueDate: daysAgo(1), assignedTo: michael.id },
    { providerNpi: "1234567897", title: "Upload verification PDFs to committee folder", description: "Ensure all PSV PDFs are in committee folder for Emily Thompson", priority: TaskPriority.HIGH, status: TaskStatus.OPEN, dueDate: daysFromNow(2), assignedTo: sarah.id },
    { providerNpi: "1234567899", title: "Confirm invite receipt", description: "Confirm William Park received onboarding email — no response in 3 days", priority: TaskPriority.LOW, status: TaskStatus.OPEN, dueDate: daysFromNow(5), assignedTo: sarah.id },
    { providerNpi: "1234567900", title: "Chase missing board certification", description: "Sophia Chen has not uploaded board certification", priority: TaskPriority.MEDIUM, status: TaskStatus.OPEN, dueDate: daysFromNow(4), assignedTo: michael.id },
    { providerNpi: "1234567901", title: "Run NPDB query", description: "Submit NPDB query for Marcus Johnson pre-committee", priority: TaskPriority.HIGH, status: TaskStatus.OPEN, dueDate: daysFromNow(1), assignedTo: sarah.id },
    { providerNpi: "1234567902", title: "Send application invite", description: "Send onboarding link to Angela Rivera", priority: TaskPriority.MEDIUM, status: TaskStatus.OPEN, dueDate: daysFromNow(2), assignedTo: michael.id },
    { providerNpi: "1234567904", title: "Verify NCCPA board status", description: "Run NCCPA bot for Rachel Kim — board cert uploaded but not verified", priority: TaskPriority.MEDIUM, status: TaskStatus.IN_PROGRESS, dueDate: daysFromNow(3), assignedTo: michael.id },
  ];

  for (const t of taskDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: t.providerNpi } });
    if (!providerRecord) continue;
    await prisma.task.create({
      data: {
        providerId: providerRecord.id,
        title: t.title,
        description: t.description,
        assignedToId: t.assignedTo,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        createdById: adminUser.id,
      },
    });
  }
  console.log(`  ✓ Tasks: ${taskDefs.length} created`);

  // ─── Communications ────────────────────────────────────────────────────────

  const commDefs = [
    { npi: "1234567891", type: CommunicationType.OUTREACH_EMAIL, subject: "Welcome to Essen Credentialing", body: "Dear Dr. Harrison, welcome to the Essen Medical credentialing process. Please complete your application at your earliest convenience.", fromUserId: sarah.id, toAddress: "james.harrison@gmail.com", daysAgoN: 35 },
    { npi: "1234567892", type: CommunicationType.FOLLOW_UP_EMAIL, subject: "Credentialing Update — Committee Scheduled", body: "Dear Dr. Santos, your application has been approved for committee review. The next session is scheduled for next week.", fromUserId: sarah.id, toAddress: "maria.santos@gmail.com", daysAgoN: 5 },
    { npi: "1234567893", type: CommunicationType.OUTREACH_EMAIL, subject: "Credentialing Approved", body: "Dear Dr. Kim, we are pleased to inform you that your credentialing application has been approved.", fromUserId: adminUser.id, toAddress: "robert.kim@gmail.com", daysAgoN: 10 },
    { npi: "1234567894", type: CommunicationType.FOLLOW_UP_EMAIL, subject: "Missing Documents Reminder", body: "Dear Ms. Walsh, we are still awaiting your BLS card and professional liability insurance certificate. Please upload at your earliest convenience.", fromUserId: michael.id, toAddress: "jennifer.walsh@gmail.com", daysAgoN: 5 },
    { npi: "1234567895", type: CommunicationType.OUTREACH_EMAIL, subject: "Welcome to Essen Credentialing", body: "Dear Dr. Russo, please complete your credentialing application using the link provided.", fromUserId: sarah.id, toAddress: "anthony.russo@gmail.com", daysAgoN: 7 },
    { npi: "1234567896", type: CommunicationType.OUTREACH_EMAIL, subject: "Application Received", body: "Dear Mr. Mendez, your application has been received and is currently under review.", fromUserId: michael.id, toAddress: "carlos.mendez@gmail.com", daysAgoN: 20 },
    { npi: "1234567897", type: CommunicationType.FOLLOW_UP_EMAIL, subject: "Committee Review Notification", body: "Dear Dr. Thompson, your application is currently before the credentialing committee for review.", fromUserId: sarah.id, toAddress: "emily.thompson@gmail.com", daysAgoN: 2 },
    { npi: "1234567898", type: CommunicationType.OUTREACH_EMAIL, subject: "Credentialing Approved", body: "Dear Ms. Davis, we are delighted to inform you that your credentialing application has been approved.", fromUserId: michael.id, toAddress: "patricia.davis@gmail.com", daysAgoN: 30 },
    { npi: "1234567901", type: CommunicationType.OUTREACH_EMAIL, subject: "Committee Review Scheduled", body: "Dear Dr. Johnson, your application is complete and has been added to the upcoming committee agenda.", fromUserId: sarah.id, toAddress: "marcus.johnson@gmail.com", daysAgoN: 2 },
    { npi: "1234567903", type: CommunicationType.INTERNAL_NOTE, subject: null, body: "Dr. Mitchell is a high-priority hire for the Bronx facility. Expedited review requested by Medical Director.", fromUserId: adminUser.id, toAddress: null, daysAgoN: 45 },
  ];

  for (const c of commDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: c.npi } });
    if (!providerRecord) continue;
    await prisma.communication.create({
      data: {
        providerId: providerRecord.id,
        communicationType: c.type,
        direction: c.type === CommunicationType.INTERNAL_NOTE ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
        channel: c.type === CommunicationType.INTERNAL_NOTE ? CommunicationChannel.INTERNAL : CommunicationChannel.EMAIL,
        fromUserId: c.fromUserId,
        toAddress: c.toAddress,
        subject: c.subject,
        body: c.body,
        deliveryStatus: DeliveryStatus.DELIVERED,
        sentAt: daysAgo(c.daysAgoN),
      },
    });
  }
  console.log(`  ✓ Communications: ${commDefs.length} created`);

  // ─── Bot Runs + Verification Records ──────────────────────────────────────

  const botRunDefs = [
    {
      npi: "1234567893", botType: BotType.LICENSE_VERIFICATION, status: BotStatus.COMPLETED,
      startedAt: daysAgo(15), completedAt: daysAgo(15),
      inputData: { state: "NY", licenseNumber: "276543" },
      outputData: { licenseStatus: "Active", expirationDate: "2027-06-30" },
      verif: { credentialType: CredentialType.LICENSE, status: VerificationStatus.VERIFIED, expDate: daysFromNow(500), source: "https://www.op.nysed.gov/", details: { status: "Active", expirationDate: "2027-06-30", boardAction: "None" }, filename: "NY License Verification, Exp. 06.30.2027" },
    },
    {
      npi: "1234567893", botType: BotType.DEA_VERIFICATION, status: BotStatus.COMPLETED,
      startedAt: daysAgo(14), completedAt: daysAgo(14),
      inputData: { deaNumber: "BK4567892" },
      outputData: { status: "Active", schedules: "II, III, IV, V" },
      verif: { credentialType: CredentialType.DEA, status: VerificationStatus.VERIFIED, expDate: daysFromNow(400), source: "https://apps.deadiversion.usdoj.gov/", details: { status: "Active", schedules: "II-V", expirationDate: "2027-03-31" }, filename: "DEA Verification, Exp. 03.31.2027" },
    },
    {
      npi: "1234567893", botType: BotType.OIG_SANCTIONS, status: BotStatus.COMPLETED,
      startedAt: daysAgo(13), completedAt: daysAgo(13),
      inputData: { firstName: "Robert", lastName: "Kim", npi: "1234567893" },
      outputData: { result: "No exclusion found" },
      verif: { credentialType: CredentialType.OIG_SANCTIONS, status: VerificationStatus.VERIFIED, expDate: null, source: "https://exclusions.oig.hhs.gov/", details: { result: "Clear", searchDate: daysAgo(13).toISOString() }, filename: `OIG Sanctions Check ${new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\//g, ".")}` },
    },
    {
      npi: "1234567898", botType: BotType.LICENSE_VERIFICATION, status: BotStatus.COMPLETED,
      startedAt: daysAgo(40), completedAt: daysAgo(40),
      inputData: { state: "NY", licenseNumber: "PA87654" },
      outputData: { licenseStatus: "Active" },
      verif: { credentialType: CredentialType.LICENSE, status: VerificationStatus.VERIFIED, expDate: daysFromNow(250), source: "https://www.op.nysed.gov/", details: { status: "Active", expirationDate: "2025-12-31" }, filename: "NY License Verification, Exp. 12.31.2025" },
    },
    {
      npi: "1234567891", botType: BotType.LICENSE_VERIFICATION, status: BotStatus.RUNNING,
      startedAt: daysAgo(0), completedAt: null,
      inputData: { state: "NY", licenseNumber: "287654" },
      outputData: null,
      verif: null,
    },
    {
      npi: "1234567892", botType: BotType.LICENSE_VERIFICATION, status: BotStatus.COMPLETED,
      startedAt: daysAgo(10), completedAt: daysAgo(10),
      inputData: { state: "NY", licenseNumber: "298765" },
      outputData: { licenseStatus: "Active" },
      verif: { credentialType: CredentialType.LICENSE, status: VerificationStatus.VERIFIED, expDate: daysFromNow(180), source: "https://www.op.nysed.gov/", details: { status: "Active", expirationDate: "2025-10-31" }, filename: "NY License Verification, Exp. 10.31.2025" },
    },
    {
      npi: "1234567897", botType: BotType.LICENSE_VERIFICATION, status: BotStatus.COMPLETED,
      startedAt: daysAgo(20), completedAt: daysAgo(20),
      inputData: { state: "NY", licenseNumber: "254321" },
      outputData: { licenseStatus: "Active" },
      verif: { credentialType: CredentialType.LICENSE, status: VerificationStatus.VERIFIED, expDate: daysFromNow(450), source: "https://www.op.nysed.gov/", details: { status: "Active", expirationDate: "2026-08-31" }, filename: "NY License Verification, Exp. 08.31.2026" },
    },
    {
      npi: "1234567901", botType: BotType.OIG_SANCTIONS, status: BotStatus.COMPLETED,
      startedAt: daysAgo(5), completedAt: daysAgo(5),
      inputData: { firstName: "Marcus", lastName: "Johnson", npi: "1234567901" },
      outputData: { result: "No exclusion found" },
      verif: { credentialType: CredentialType.OIG_SANCTIONS, status: VerificationStatus.VERIFIED, expDate: null, source: "https://exclusions.oig.hhs.gov/", details: { result: "Clear" }, filename: `OIG Sanctions Check ${new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\//g, ".")}` },
    },
  ];

  let botRunCount = 0;
  let verifCount = 0;
  for (const b of botRunDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: b.npi } });
    if (!providerRecord) continue;
    const botRun = await prisma.botRun.create({
      data: {
        providerId: providerRecord.id,
        botType: b.botType,
        triggeredBy: BotTriggeredBy.MANUAL,
        triggeredByUserId: adminUser.id,
        status: b.status,
        attemptCount: 1,
        queuedAt: new Date(b.startedAt!.getTime() - 30000),
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        inputData: b.inputData,
        outputData: b.outputData ?? undefined,
      },
    });
    botRunCount++;

    if (b.verif) {
      await prisma.verificationRecord.create({
        data: {
          providerId: providerRecord.id,
          botRunId: botRun.id,
          credentialType: b.verif.credentialType,
          status: b.verif.status,
          verifiedDate: b.completedAt!,
          expirationDate: b.verif.expDate,
          sourceWebsite: b.verif.source,
          resultDetails: b.verif.details,
          outputFilename: b.verif.filename,
          isFlagged: false,
        },
      });
      verifCount++;
    }
  }
  console.log(`  ✓ Bot runs: ${botRunCount} created`);
  console.log(`  ✓ Verification records: ${verifCount} created`);

  // ─── Sanctions Checks ──────────────────────────────────────────────────────

  const sanctionNpis = ["1234567893", "1234567898", "1234567892", "1234567897", "1234567901", "1234567903"];
  for (const npi of sanctionNpis) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi } });
    if (!providerRecord) continue;
    await prisma.sanctionsCheck.create({
      data: {
        providerId: providerRecord.id,
        source: SanctionsSource.OIG,
        runDate: daysAgo(Math.floor(Math.random() * 20) + 5),
        triggeredBy: SanctionsTriggeredBy.MANUAL,
        triggeredByUserId: adminUser.id,
        result: SanctionsResult.CLEAR,
        isAcknowledged: true,
        acknowledgedById: adminUser.id,
        acknowledgedAt: daysAgo(3),
      },
    });
    await prisma.sanctionsCheck.create({
      data: {
        providerId: providerRecord.id,
        source: SanctionsSource.SAM_GOV,
        runDate: daysAgo(Math.floor(Math.random() * 20) + 5),
        triggeredBy: SanctionsTriggeredBy.MANUAL,
        triggeredByUserId: adminUser.id,
        result: SanctionsResult.CLEAR,
        isAcknowledged: true,
        acknowledgedById: adminUser.id,
        acknowledgedAt: daysAgo(3),
      },
    });
  }
  console.log(`  ✓ Sanctions checks: ${sanctionNpis.length * 2} created`);

  // ─── NPDB Records ──────────────────────────────────────────────────────────

  const npdbNpis = ["1234567893", "1234567898", "1234567892", "1234567897", "1234567901", "1234567903"];
  for (const npi of npdbNpis) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi } });
    if (!providerRecord) continue;
    await prisma.nPDBRecord.create({
      data: {
        providerId: providerRecord.id,
        queryDate: daysAgo(Math.floor(Math.random() * 25) + 5),
        queryType: NpdbQueryType.INITIAL,
        continuousQueryEnrolled: true,
        continuousQueryEnrollmentDate: daysAgo(10),
        result: NpdbResult.NO_REPORTS,
        reportCount: 0,
        reports: [],
        queryConfirmationNumber: `NPDB-${Math.floor(Math.random() * 900000) + 100000}`,
        isAcknowledged: true,
        acknowledgedById: adminUser.id,
        acknowledgedAt: daysAgo(2),
      },
    });
  }
  console.log(`  ✓ NPDB records: ${npdbNpis.length} created`);

  // ─── Committee Sessions ────────────────────────────────────────────────────

  const sessionPast = await prisma.committeeSession.create({
    data: {
      sessionDate: daysAgo(30),
      sessionTime: "10:00 AM",
      location: "Essen Medical – Conference Room B, 4th Floor",
      status: CommitteeSessionStatus.COMPLETED,
      committeeMemberIds: [drPatel.id, drWilliams.id, adminUser.id],
      notes: "Quorum reached. All 3 providers reviewed. Minutes filed.",
    },
  });

  const sessionUpcoming = await prisma.committeeSession.create({
    data: {
      sessionDate: daysFromNow(7),
      sessionTime: "10:00 AM",
      location: "Essen Medical – Conference Room B, 4th Floor",
      status: CommitteeSessionStatus.SCHEDULED,
      committeeMemberIds: [drPatel.id, drWilliams.id],
      notes: "Two providers on agenda — please ensure PSV PDFs are uploaded 48 hours prior.",
    },
  });

  const sessionInProgress = await prisma.committeeSession.create({
    data: {
      sessionDate: new Date(),
      sessionTime: "2:00 PM",
      location: "Video Conference – Microsoft Teams",
      status: CommitteeSessionStatus.IN_PROGRESS,
      committeeMemberIds: [drPatel.id, drWilliams.id, adminUser.id],
      notes: "Session in progress.",
    },
  });

  console.log("  ✓ Committee sessions: 3 created");

  // Past session: Robert Kim (APPROVED) and Patricia Davis (APPROVED)
  const kimProvider = await prisma.provider.findUnique({ where: { npi: "1234567893" } });
  const davisProvider = await prisma.provider.findUnique({ where: { npi: "1234567898" } });
  if (kimProvider) {
    await prisma.committeeProvider.create({
      data: {
        committeeSessionId: sessionPast.id,
        providerId: kimProvider.id,
        agendaOrder: 1,
        decision: CommitteeDecision.APPROVED,
        decisionDate: daysAgo(30),
        decisionById: drPatel.id,
        committeeNotes: "All verifications clear. License active. No NPDB reports. Approved unanimously.",
      },
    });
  }
  if (davisProvider) {
    await prisma.committeeProvider.create({
      data: {
        committeeSessionId: sessionPast.id,
        providerId: davisProvider.id,
        agendaOrder: 2,
        decision: CommitteeDecision.APPROVED,
        decisionDate: daysAgo(30),
        decisionById: drWilliams.id,
        committeeNotes: "Board certification verified via NCCPA. Clean record. Approved.",
      },
    });
  }

  // Upcoming session: Maria Santos + Marcus Johnson
  const santosProvider = await prisma.provider.findUnique({ where: { npi: "1234567892" } });
  const johnsonProvider = await prisma.provider.findUnique({ where: { npi: "1234567901" } });
  if (santosProvider) {
    await prisma.committeeProvider.create({
      data: {
        committeeSessionId: sessionUpcoming.id,
        providerId: santosProvider.id,
        agendaOrder: 1,
      },
    });
  }
  if (johnsonProvider) {
    await prisma.committeeProvider.create({
      data: {
        committeeSessionId: sessionUpcoming.id,
        providerId: johnsonProvider.id,
        agendaOrder: 2,
      },
    });
  }

  // In-progress session: Emily Thompson
  const thompsonProvider = await prisma.provider.findUnique({ where: { npi: "1234567897" } });
  if (thompsonProvider) {
    await prisma.committeeProvider.create({
      data: {
        committeeSessionId: sessionInProgress.id,
        providerId: thompsonProvider.id,
        agendaOrder: 1,
        committeeNotes: "Under review — NPDB clear, license active, awaiting final vote.",
      },
    });
  }

  console.log("  ✓ Committee provider entries: 5 created");

  // ─── Enrollments ───────────────────────────────────────────────────────────

  const enrollmentDefs = [
    { npi: "1234567893", payer: "Aetna Better Health NY", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(80), effectiveDate: daysAgo(50), confirmationNumber: "AET-2024-88431", assignedTo: michael.id },
    { npi: "1234567893", payer: "UnitedHealthcare", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(75), effectiveDate: daysAgo(45), confirmationNumber: "UHC-2024-99012", assignedTo: michael.id },
    { npi: "1234567893", payer: "Anthem BCBS", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_AVAILITY, status: EnrollmentStatus.PENDING_PAYER, submittedAt: daysAgo(20), followUpDue: daysFromNow(7), assignedTo: michael.id },
    { npi: "1234567898", payer: "Cigna", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(100), effectiveDate: daysAgo(70), confirmationNumber: "CGN-2024-55890", assignedTo: sarah.id },
    { npi: "1234567898", payer: "Medicaid NY", type: EnrollmentType.FACILITY_BTC, method: SubmissionMethod.EMAIL, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(95), effectiveDate: daysAgo(60), confirmationNumber: "MCNY-2024-11234", assignedTo: sarah.id },
    { npi: "1234567892", payer: "Medicare", type: EnrollmentType.DELEGATED, method: SubmissionMethod.EMAIL, status: EnrollmentStatus.SUBMITTED, submittedAt: daysAgo(8), assignedTo: sarah.id },
    { npi: "1234567892", payer: "Emblem Health", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_AVAILITY, status: EnrollmentStatus.DRAFT, assignedTo: sarah.id },
    { npi: "1234567897", payer: "Humana", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.SUBMITTED, submittedAt: daysAgo(15), followUpDue: daysFromNow(3), assignedTo: michael.id },
    { npi: "1234567891", payer: "Aetna Better Health NY", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.DRAFT, assignedTo: sarah.id },
    { npi: "1234567901", payer: "Cigna", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.DRAFT, assignedTo: sarah.id },
    { npi: "1234567903", payer: "UnitedHealthcare", type: EnrollmentType.DELEGATED, method: SubmissionMethod.PORTAL_MPP, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(115), effectiveDate: daysAgo(85), confirmationNumber: "UHC-2024-76543", assignedTo: michael.id },
    { npi: "1234567903", payer: "Medicaid NY", type: EnrollmentType.FACILITY_BTC, method: SubmissionMethod.EMAIL, status: EnrollmentStatus.ENROLLED, submittedAt: daysAgo(110), effectiveDate: daysAgo(80), confirmationNumber: "MCNY-2024-54321", assignedTo: michael.id },
  ];

  for (const e of enrollmentDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: e.npi } });
    if (!providerRecord) continue;
    await prisma.enrollment.create({
      data: {
        providerId: providerRecord.id,
        payerName: e.payer,
        enrollmentType: e.type,
        submissionMethod: e.method,
        status: e.status,
        submittedAt: e.submittedAt ?? null,
        submittedById: e.submittedAt ? (e.assignedTo === sarah.id ? sarah.id : michael.id) : null,
        payerConfirmationNumber: e.confirmationNumber ?? null,
        effectiveDate: e.effectiveDate ?? null,
        followUpDueDate: e.followUpDue ?? null,
        assignedToId: e.assignedTo,
      },
    });
  }
  console.log(`  ✓ Enrollments: ${enrollmentDefs.length} created`);

  // ─── Expirables ────────────────────────────────────────────────────────────

  const expirableDefs = [
    { npi: "1234567891", type: ExpirableType.BLS, status: ExpirableStatus.CURRENT, expDate: daysFromNow(180), nextCheck: daysFromNow(150) },
    { npi: "1234567891", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(365), nextCheck: daysFromNow(300) },
    { npi: "1234567892", type: ExpirableType.BLS, status: ExpirableStatus.EXPIRING_SOON, expDate: daysFromNow(25), nextCheck: daysFromNow(5) },
    { npi: "1234567892", type: ExpirableType.MALPRACTICE_INSURANCE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(200), nextCheck: daysFromNow(170) },
    { npi: "1234567893", type: ExpirableType.DEA, status: ExpirableStatus.CURRENT, expDate: daysFromNow(400), nextCheck: daysFromNow(340) },
    { npi: "1234567893", type: ExpirableType.ACLS, status: ExpirableStatus.CURRENT, expDate: daysFromNow(300), nextCheck: daysFromNow(270) },
    { npi: "1234567893", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(500), nextCheck: daysFromNow(440) },
    { npi: "1234567896", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.EXPIRING_SOON, expDate: daysFromNow(20), nextCheck: daysFromNow(1) },
    { npi: "1234567897", type: ExpirableType.MALPRACTICE_INSURANCE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(90), nextCheck: daysFromNow(60) },
    { npi: "1234567897", type: ExpirableType.DEA, status: ExpirableStatus.CURRENT, expDate: daysFromNow(350), nextCheck: daysFromNow(300) },
    { npi: "1234567898", type: ExpirableType.BLS, status: ExpirableStatus.CURRENT, expDate: daysFromNow(250), nextCheck: daysFromNow(220) },
    { npi: "1234567901", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(320), nextCheck: daysFromNow(280) },
    { npi: "1234567901", type: ExpirableType.DEA, status: ExpirableStatus.CURRENT, expDate: daysFromNow(400), nextCheck: daysFromNow(350) },
    { npi: "1234567902", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.EXPIRING_SOON, expDate: daysFromNow(40), nextCheck: daysFromNow(10) },
    { npi: "1234567903", type: ExpirableType.STATE_LICENSE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(600), nextCheck: daysFromNow(550) },
    { npi: "1234567903", type: ExpirableType.MALPRACTICE_INSURANCE, status: ExpirableStatus.CURRENT, expDate: daysFromNow(180), nextCheck: daysFromNow(150) },
    { npi: "1234567904", type: ExpirableType.BLS, status: ExpirableStatus.CURRENT, expDate: daysFromNow(210), nextCheck: daysFromNow(180) },
  ];

  for (const ex of expirableDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: ex.npi } });
    if (!providerRecord) continue;
    await prisma.expirable.create({
      data: {
        providerId: providerRecord.id,
        expirableType: ex.type,
        status: ex.status,
        expirationDate: ex.expDate,
        nextCheckDate: ex.nextCheck,
        lastVerifiedDate: daysAgo(30),
      },
    });
  }
  console.log(`  ✓ Expirables: ${expirableDefs.length} created`);

  // ─── Hospital Privileges ───────────────────────────────────────────────────

  const hospPrivilegeDefs = [
    { npi: "1234567893", facility: "Montefiore Medical Center", type: "Attending Physician – Psychiatry", status: HospitalPrivilegeStatus.APPROVED, appliedDate: daysAgo(60), approvedDate: daysAgo(20), expDate: daysFromNow(700) },
    { npi: "1234567903", facility: "NYC Health + Hospitals / Lincoln", type: "Attending Physician – Internal Medicine", status: HospitalPrivilegeStatus.APPROVED, appliedDate: daysAgo(100), approvedDate: daysAgo(60), expDate: daysFromNow(700) },
    { npi: "1234567892", facility: "Montefiore Medical Center", type: "Consulting Physician", status: HospitalPrivilegeStatus.PENDING_REVIEW, appliedDate: daysAgo(30) },
    { npi: "1234567897", facility: "NYC Health + Hospitals / Jacobi", type: "Attending Physician – Geriatric Psych", status: HospitalPrivilegeStatus.APPLIED, appliedDate: daysAgo(10) },
  ];

  for (const hp of hospPrivilegeDefs) {
    const providerRecord = await prisma.provider.findUnique({ where: { npi: hp.npi } });
    if (!providerRecord) continue;
    await prisma.hospitalPrivilege.create({
      data: {
        providerId: providerRecord.id,
        facilityName: hp.facility,
        privilegeType: hp.type,
        status: hp.status,
        appliedDate: hp.appliedDate ?? null,
        approvedDate: hp.approvedDate ?? null,
        expirationDate: hp.expDate ?? null,
        submittedById: adminUser.id,
      },
    });
  }
  console.log(`  ✓ Hospital privileges: ${hospPrivilegeDefs.length} created`);

  // ─── Workflow Diagrams (Excalidraw) ──────────────────────────────────────

  const workflowDefs = [
    {
      name: "Provider Onboarding (End-to-End)",
      description: "Full onboarding journey from initial outreach through committee readiness. Covers iCIMS import, CAQH ingestion, application, document upload, PSV bot queue, and committee readiness.",
      category: "onboarding",
    },
    {
      name: "PSV Bot Execution",
      description: "Lifecycle of a single Primary Source Verification bot run — queue, input validation, Playwright execution, retry logic, PDF storage, and verification record creation.",
      category: "bots",
    },
    {
      name: "Committee Review",
      description: "Committee preparation, review session, and approval process — summary sheet generation, agenda creation, session decisions (approve/deny/defer/conditional).",
      category: "committee",
    },
    {
      name: "Enrollment Submission",
      description: "Enrolling a provider with a payer after credentialing approval — portal bot, FTP, or email submission methods with follow-up tracking.",
      category: "enrollment",
    },
    {
      name: "Expirables Tracking & Renewal",
      description: "Detecting expiring credentials via nightly scans, escalation thresholds (90/60/30/14/7 days), bot renewal confirmation, and provider outreach.",
      category: "expirables",
    },
    {
      name: "Sanctions Checking",
      description: "OIG LEIE and SAM.gov exclusion queries — initial check at pipeline entry, hard stop on findings, monthly recurring checks for all active providers.",
      category: "sanctions",
    },
    {
      name: "NY Medicaid ETIN Enrollment",
      description: "eMedNY enrollment workflow — ETIN affiliation, revalidation, provider signature tracking, bot submission to eMedNY Service Portal.",
      category: "medicaid",
    },
    {
      name: "NPDB Query",
      description: "National Practitioner Data Bank initial query and continuous monitoring — report review, flag/acknowledge, and ongoing alert handling.",
      category: "npdb",
    },
    {
      name: "Provider Status Lifecycle",
      description: "State diagram showing all possible provider status transitions: invited → onboarding → documents_pending → verification → committee_ready → committee_in_review → approved/denied/deferred.",
      category: "general",
    },
    {
      name: "Staff Notification & Escalation",
      description: "Alert escalation flow — specialist notification, SLA thresholds (bot failure 4h, expirable 48h, enrollment follow-up 24h, sanctions/NPDB 2h), manager escalation.",
      category: "general",
    },
  ];

  const defaultScene = { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };

  for (const wf of workflowDefs) {
    try {
      await prisma.workflow.create({
        data: {
          name: wf.name,
          description: wf.description,
          category: wf.category,
          sceneData: defaultScene,
          createdBy: adminUser.id,
          updatedBy: adminUser.id,
        },
      });
    } catch {
      // Skip if already seeded
    }
  }
  console.log(`  ✓ Workflows: ${workflowDefs.length} created`);

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
