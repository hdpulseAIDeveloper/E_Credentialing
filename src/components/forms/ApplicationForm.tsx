"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/trpc/react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","VI","GU","AS","MP",
] as const;

const DEGREE_TYPES = ["MD", "DO", "PA", "NP", "LCSW", "LMHC", "PhD", "PsyD", "Other"] as const;

const PRIVILEGE_TYPES = ["Active", "Courtesy", "Consulting", "Provisional", "Temporary"] as const;

const LICENSE_TYPES = [
  "Medical (MD/DO)", "Physician Assistant", "Nurse Practitioner",
  "LCSW", "LMHC", "State Controlled Substance", "Other",
] as const;

const AFFILIATION_STATUSES = ["Active", "Pending", "Inactive", "Resigned", "Revoked", "Suspended"] as const;

// ---------------------------------------------------------------------------
// Empty row templates for repeatable groups
// ---------------------------------------------------------------------------

const emptyBoardCert = {
  boardName: "", specialty: "", certificationDate: "", expirationDate: "",
  certificateNumber: "", isBoardEligible: false,
};
const emptyWorkHistory = {
  employerName: "", positionTitle: "", startDate: "", endDate: "",
  city: "", state: "", reasonForLeaving: "", isCurrentPosition: false,
};
const emptyHospitalAffiliation = {
  hospitalName: "", city: "", state: "", privilegeType: "",
  appointmentDate: "", currentStatus: "",
};
const emptyLicense = {
  state: "", licenseNumber: "", licenseType: "", issueDate: "",
  expirationDate: "", isPrimary: false,
};

// ---------------------------------------------------------------------------
// Zod schemas — one per section
// ---------------------------------------------------------------------------

const optStr = z.string().optional().or(z.literal(""));

const sectionSchemas = [
  // 0 — Personal Info
  z.object({
    legalFirstName: z.string().min(1, "Required"),
    legalLastName: z.string().min(1, "Required"),
    legalMiddleName: optStr,
    dateOfBirth: z.string().min(1, "Required"),
    gender: optStr,
    ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, "Format: XXX-XX-XXXX").optional().or(z.literal("")),
  }),
  // 1 — Contact
  z.object({
    mobilePhone: z.string().min(10, "Required"),
    personalEmail: z.string().email("Invalid email"),
    homeAddressLine1: z.string().min(1, "Required"),
    homeCity: z.string().min(1, "Required"),
    homeState: z.string().min(2, "Required"),
    homeZip: z.string().min(5, "Required"),
  }),
  // 2 — Professional IDs
  z.object({
    npiNumber: z.string().regex(/^\d{10}$/, "NPI must be exactly 10 digits"),
    deaNumber: optStr,
    caqhId: optStr,
    medicarePtan: optStr,
    medicaidId: optStr,
    ecfmgNumber: optStr,
  }),
  // 3 — Education
  z.object({
    medicalSchoolName: z.string().min(1, "Required"),
    schoolCountry: z.string().min(1, "Required"),
    graduationYear: z.string().min(4, "Enter a valid year"),
    degreeType: z.string().min(1, "Required"),
    internshipFacility: optStr,
    internshipStartDate: optStr,
    internshipEndDate: optStr,
    residencyFacility: optStr,
    residencySpecialty: optStr,
    residencyStartDate: optStr,
    residencyEndDate: optStr,
    fellowshipFacility: optStr,
    fellowshipSpecialty: optStr,
    fellowshipStartDate: optStr,
    fellowshipEndDate: optStr,
  }),
  // 4 — Board Certifications
  z.object({
    boardCertifications: z.array(z.object({
      boardName: z.string().min(1, "Required"),
      specialty: z.string().min(1, "Required"),
      certificationDate: optStr,
      expirationDate: optStr,
      certificateNumber: optStr,
      isBoardEligible: z.boolean().optional(),
    })).min(1, "Add at least one entry"),
  }),
  // 5 — Work History
  z.object({
    workHistory: z.array(z.object({
      employerName: z.string().min(1, "Required"),
      positionTitle: z.string().min(1, "Required"),
      startDate: z.string().min(1, "Required"),
      endDate: optStr,
      city: z.string().min(1, "Required"),
      state: z.string().min(1, "Required"),
      reasonForLeaving: optStr,
      isCurrentPosition: z.boolean().optional(),
    })).min(1, "Add at least one entry"),
  }),
  // 6 — Malpractice
  z.object({
    carrierName: z.string().min(1, "Required"),
    policyNumber: z.string().min(1, "Required"),
    coverageAmountPerOccurrence: z.string().min(1, "Required"),
    coverageAmountAggregate: z.string().min(1, "Required"),
    effectiveDate: z.string().min(1, "Required"),
    expirationDate: z.string().min(1, "Required"),
    hasMalpracticeClaim: z.string().min(1, "Please select an option"),
    claimDetails: optStr,
  }).refine(
    (d) => d.hasMalpracticeClaim !== "Yes" || (d.claimDetails && d.claimDetails.length > 0),
    { message: "Please describe the claim(s)", path: ["claimDetails"] },
  ),
  // 7 — Hospital Affiliations
  z.object({
    hospitalAffiliations: z.array(z.object({
      hospitalName: z.string().min(1, "Required"),
      city: z.string().min(1, "Required"),
      state: z.string().min(1, "Required"),
      privilegeType: z.string().min(1, "Required"),
      appointmentDate: z.string().min(1, "Required"),
      currentStatus: z.string().min(1, "Required"),
    })).min(1, "Add at least one entry"),
  }),
  // 8 — Licenses
  z.object({
    licenses: z.array(z.object({
      state: z.string().min(1, "Required"),
      licenseNumber: z.string().min(1, "Required"),
      licenseType: z.string().min(1, "Required"),
      issueDate: z.string().min(1, "Required"),
      expirationDate: z.string().min(1, "Required"),
      isPrimary: z.boolean().optional(),
    })).min(1, "Add at least one entry"),
  }),
  // 9 — Attestation
  z.object({
    attestTruthful: z.literal(true, { errorMap: () => ({ message: "You must agree to continue" }) }),
    attestAuthorizeVerification: z.literal(true, { errorMap: () => ({ message: "You must agree to continue" }) }),
    attestNotifyChanges: z.literal(true, { errorMap: () => ({ message: "You must agree to continue" }) }),
    attestUnderstandFalsification: z.literal(true, { errorMap: () => ({ message: "You must agree to continue" }) }),
    signatureName: z.string().min(1, "Your typed signature is required"),
    signatureDate: z.string().min(1, "Required"),
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${hasError ? "border-red-400 focus:ring-red-400/40" : ""}`;

const selectCls = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${hasError ? "border-red-400 focus:ring-red-400/40" : ""}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function fe(errors: any, ...path: (string | number)[]): string | undefined {
  let c = errors;
  for (const p of path) { if (!c) return undefined; c = c[p]; }
  return c?.message as string | undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-500 text-xs mt-1">{msg}</p>;
}

function getDefaults(section: number): Record<string, unknown> {
  switch (section) {
    case 4: return { boardCertifications: [{ ...emptyBoardCert }] };
    case 5: return { workHistory: [{ ...emptyWorkHistory }] };
    case 7: return { hospitalAffiliations: [{ ...emptyHospitalAffiliation }] };
    case 8: return { licenses: [{ ...emptyLicense }] };
    case 9: return {
      attestTruthful: false, attestAuthorizeVerification: false,
      attestNotifyChanges: false, attestUnderstandFalsification: false,
      signatureName: "", signatureDate: new Date().toISOString().split("T")[0],
    };
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  section: number;
  onNext: () => void;
  onPrev: () => void;
  token: string;
}

// ---------------------------------------------------------------------------
// Public export — keys by section so form state resets cleanly
// ---------------------------------------------------------------------------

export function ApplicationForm(props: Props) {
  return <SectionForm key={props.section} {...props} />;
}

// ---------------------------------------------------------------------------
// Inner form — one instance per section
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function SectionForm({ section, onNext, onPrev, token }: Props) {
  const schema = sectionSchemas[section] ?? z.object({});
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(schema as any),
    defaultValues: getDefaults(section),
  });

  const boardCerts = useFieldArray({ control, name: "boardCertifications" });
  const workItems = useFieldArray({ control, name: "workHistory" });
  const hospitalItems = useFieldArray({ control, name: "hospitalAffiliations" });
  const licenseItems = useFieldArray({ control, name: "licenses" });

  const hasMalpracticeClaim = watch("hasMalpracticeClaim");
  const watchedWork = watch("workHistory");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[ApplicationForm] Auto-saving section", section);
    }, 60000);
    return () => clearInterval(interval);
  }, [section]);

  const onSubmit = async (data: unknown) => {
    setSaving(true);
    try {
      const payload = { token, section, data: data as Record<string, unknown> };
      const res = await fetch("/api/application/save-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) console.error("[ApplicationForm] Save failed:", await res.text());
    } catch (err) {
      console.error("[ApplicationForm] Save error:", err);
    } finally {
      setSaving(false);
    }
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ================================================================ */}
      {/* Section 0 — Personal Information                                 */}
      {/* ================================================================ */}
      {section === 0 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal First Name *</label>
              <input {...register("legalFirstName")} className={inputCls(!!errors.legalFirstName)} />
              <Err msg={fe(errors, "legalFirstName")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal Last Name *</label>
              <input {...register("legalLastName")} className={inputCls(!!errors.legalLastName)} />
              <Err msg={fe(errors, "legalLastName")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input {...register("legalMiddleName")} className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input type="date" {...register("dateOfBirth")} className={inputCls(!!errors.dateOfBirth)} />
              <Err msg={fe(errors, "dateOfBirth")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select {...register("gender")} className={selectCls(false)}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SSN <span className="text-gray-400 text-xs">(XXX-XX-XXXX)</span>
              </label>
              <input
                {...register("ssn")}
                type="password"
                placeholder="XXX-XX-XXXX"
                autoComplete="off"
                className={inputCls(!!errors.ssn)}
              />
              <Err msg={fe(errors, "ssn")} />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 1 — Contact Information                                  */}
      {/* ================================================================ */}
      {section === 1 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Phone *</label>
              <input {...register("mobilePhone")} type="tel" className={inputCls(!!errors.mobilePhone)} />
              <Err msg={fe(errors, "mobilePhone")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email *</label>
              <input {...register("personalEmail")} type="email" className={inputCls(!!errors.personalEmail)} />
              <Err msg={fe(errors, "personalEmail")} />
            </div>
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Address *</label>
              <input {...register("homeAddressLine1")} placeholder="Street address" className={`${inputCls(!!errors.homeAddressLine1)} mb-2`} />
              <Err msg={fe(errors, "homeAddressLine1")} />
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <input {...register("homeCity")} placeholder="City" className={inputCls(!!errors.homeCity)} />
                  <Err msg={fe(errors, "homeCity")} />
                </div>
                <div>
                  <input {...register("homeState")} placeholder="State" className={inputCls(!!errors.homeState)} maxLength={2} />
                  <Err msg={fe(errors, "homeState")} />
                </div>
                <div>
                  <input {...register("homeZip")} placeholder="ZIP" className={inputCls(!!errors.homeZip)} />
                  <Err msg={fe(errors, "homeZip")} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 2 — Professional IDs                                     */}
      {/* ================================================================ */}
      {section === 2 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Professional Identifiers</h3>
          <p className="text-sm text-gray-500">Enter your professional identification numbers. NPI is required; others are optional but recommended.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NPI Number *</label>
              <input {...register("npiNumber")} placeholder="10-digit NPI" maxLength={10} className={inputCls(!!errors.npiNumber)} />
              <Err msg={fe(errors, "npiNumber")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DEA Number</label>
              <input {...register("deaNumber")} className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CAQH ID</label>
              <input {...register("caqhId")} className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicare PTAN</label>
              <input {...register("medicarePtan")} className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicaid ID</label>
              <input {...register("medicaidId")} className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ECFMG Number <span className="text-gray-400 text-xs">(international graduates)</span>
              </label>
              <input {...register("ecfmgNumber")} className={inputCls(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 3 — Education                                            */}
      {/* ================================================================ */}
      {section === 3 && (
        <div className="space-y-5">
          {/* Medical / Professional School */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Medical / Professional School</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                <input {...register("medicalSchoolName")} className={inputCls(!!errors.medicalSchoolName)} />
                <Err msg={fe(errors, "medicalSchoolName")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <input {...register("schoolCountry")} placeholder="e.g. United States" className={inputCls(!!errors.schoolCountry)} />
                <Err msg={fe(errors, "schoolCountry")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Graduation Year *</label>
                <input {...register("graduationYear")} placeholder="YYYY" maxLength={4} className={inputCls(!!errors.graduationYear)} />
                <Err msg={fe(errors, "graduationYear")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Degree Type *</label>
                <select {...register("degreeType")} className={selectCls(!!errors.degreeType)}>
                  <option value="">Select…</option>
                  {DEGREE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <Err msg={fe(errors, "degreeType")} />
              </div>
            </div>
          </div>

          {/* Internship */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">
              Internship <span className="text-sm font-normal text-gray-400">(if applicable)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <input {...register("internshipFacility")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" {...register("internshipStartDate")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" {...register("internshipEndDate")} className={inputCls(false)} />
              </div>
            </div>
          </div>

          {/* Residency */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">
              Residency <span className="text-sm font-normal text-gray-400">(if applicable)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <input {...register("residencyFacility")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input {...register("residencySpecialty")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" {...register("residencyStartDate")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" {...register("residencyEndDate")} className={inputCls(false)} />
              </div>
            </div>
          </div>

          {/* Fellowship */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">
              Fellowship <span className="text-sm font-normal text-gray-400">(optional)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <input {...register("fellowshipFacility")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input {...register("fellowshipSpecialty")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" {...register("fellowshipStartDate")} className={inputCls(false)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" {...register("fellowshipEndDate")} className={inputCls(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 4 — Board Certifications  (repeatable)                   */}
      {/* ================================================================ */}
      {section === 4 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Board Certifications</h3>
          <p className="text-sm text-gray-500">List all current and past board certifications. Check &ldquo;Board Eligible&rdquo; if you have not yet been certified.</p>

          <div className="space-y-4 pt-1">
            {boardCerts.fields.map((field, i) => (
              <div key={field.id} className="relative border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                {boardCerts.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => boardCerts.remove(i)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Board Name *</label>
                    <input {...register(`boardCertifications.${i}.boardName`)} className={inputCls(!!fe(errors, "boardCertifications", i, "boardName"))} />
                    <Err msg={fe(errors, "boardCertifications", i, "boardName")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specialty *</label>
                    <input {...register(`boardCertifications.${i}.specialty`)} className={inputCls(!!fe(errors, "boardCertifications", i, "specialty"))} />
                    <Err msg={fe(errors, "boardCertifications", i, "specialty")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certification Date</label>
                    <input type="date" {...register(`boardCertifications.${i}.certificationDate`)} className={inputCls(false)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                    <input type="date" {...register(`boardCertifications.${i}.expirationDate`)} className={inputCls(false)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Number</label>
                    <input {...register(`boardCertifications.${i}.certificateNumber`)} className={inputCls(false)} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" {...register(`boardCertifications.${i}.isBoardEligible`)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      Board Eligible (not yet certified)
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => boardCerts.append({ ...emptyBoardCert })}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Board Certification
          </button>
          <Err msg={fe(errors, "boardCertifications", "root")} />
          {typeof (errors as any)?.boardCertifications?.message === "string" && (
            <Err msg={(errors as any).boardCertifications.message} />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 5 — Work History  (repeatable)                           */}
      {/* ================================================================ */}
      {section === 5 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Work History</h3>
          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            Please provide a <strong>continuous</strong> work history covering at least the past 5 years. Account for any gaps.
          </div>

          <div className="space-y-4 pt-1">
            {workItems.fields.map((field, i) => {
              const isCurrent = watchedWork?.[i]?.isCurrentPosition;
              return (
                <div key={field.id} className="relative border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                  {workItems.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => workItems.remove(i)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name *</label>
                      <input {...register(`workHistory.${i}.employerName`)} className={inputCls(!!fe(errors, "workHistory", i, "employerName"))} />
                      <Err msg={fe(errors, "workHistory", i, "employerName")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Position / Title *</label>
                      <input {...register(`workHistory.${i}.positionTitle`)} className={inputCls(!!fe(errors, "workHistory", i, "positionTitle"))} />
                      <Err msg={fe(errors, "workHistory", i, "positionTitle")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                      <input type="date" {...register(`workHistory.${i}.startDate`)} className={inputCls(!!fe(errors, "workHistory", i, "startDate"))} />
                      <Err msg={fe(errors, "workHistory", i, "startDate")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date {isCurrent ? "" : "*"}</label>
                      <input type="date" {...register(`workHistory.${i}.endDate`)} disabled={!!isCurrent} className={`${inputCls(!!fe(errors, "workHistory", i, "endDate"))} disabled:bg-gray-100 disabled:cursor-not-allowed`} />
                      <Err msg={fe(errors, "workHistory", i, "endDate")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                      <input {...register(`workHistory.${i}.city`)} className={inputCls(!!fe(errors, "workHistory", i, "city"))} />
                      <Err msg={fe(errors, "workHistory", i, "city")} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                      <select {...register(`workHistory.${i}.state`)} className={selectCls(!!fe(errors, "workHistory", i, "state"))}>
                        <option value="">Select…</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <Err msg={fe(errors, "workHistory", i, "state")} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leaving</label>
                      <input {...register(`workHistory.${i}.reasonForLeaving`)} disabled={!!isCurrent} className={`${inputCls(false)} disabled:bg-gray-100 disabled:cursor-not-allowed`} />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" {...register(`workHistory.${i}.isCurrentPosition`)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        This is my current position
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => workItems.append({ ...emptyWorkHistory })}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Work History Entry
          </button>
          {typeof (errors as any)?.workHistory?.message === "string" && (
            <Err msg={(errors as any).workHistory.message} />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 6 — Malpractice Insurance                                */}
      {/* ================================================================ */}
      {section === 6 && (
        <div className="space-y-5">
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Current Malpractice Insurance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Carrier Name *</label>
                <input {...register("carrierName")} className={inputCls(!!errors.carrierName)} />
                <Err msg={fe(errors, "carrierName")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number *</label>
                <input {...register("policyNumber")} className={inputCls(!!errors.policyNumber)} />
                <Err msg={fe(errors, "policyNumber")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Per Occurrence *</label>
                <input {...register("coverageAmountPerOccurrence")} placeholder="e.g. $1,000,000" className={inputCls(!!errors.coverageAmountPerOccurrence)} />
                <Err msg={fe(errors, "coverageAmountPerOccurrence")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aggregate Coverage *</label>
                <input {...register("coverageAmountAggregate")} placeholder="e.g. $3,000,000" className={inputCls(!!errors.coverageAmountAggregate)} />
                <Err msg={fe(errors, "coverageAmountAggregate")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
                <input type="date" {...register("effectiveDate")} className={inputCls(!!errors.effectiveDate)} />
                <Err msg={fe(errors, "effectiveDate")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
                <input type="date" {...register("expirationDate")} className={inputCls(!!errors.expirationDate)} />
                <Err msg={fe(errors, "expirationDate")} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Claims History</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Have you ever had a malpractice claim filed against you? *</label>
              <select {...register("hasMalpracticeClaim")} className={selectCls(!!errors.hasMalpracticeClaim)}>
                <option value="">Select…</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
              <Err msg={fe(errors, "hasMalpracticeClaim")} />
            </div>
            {hasMalpracticeClaim === "Yes" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Please provide details of each claim *
                </label>
                <textarea
                  {...register("claimDetails")}
                  rows={4}
                  placeholder="Include date(s), nature of claim, outcome, and settlement amounts if applicable."
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${errors.claimDetails ? "border-red-400" : ""}`}
                />
                <Err msg={fe(errors, "claimDetails")} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 7 — Hospital Affiliations  (repeatable)                  */}
      {/* ================================================================ */}
      {section === 7 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Hospital Affiliations</h3>
          <p className="text-sm text-gray-500">List all current and past hospital or facility affiliations where you hold or have held privileges.</p>

          <div className="space-y-4 pt-1">
            {hospitalItems.fields.map((field, i) => (
              <div key={field.id} className="relative border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                {hospitalItems.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => hospitalItems.remove(i)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital / Facility Name *</label>
                    <input {...register(`hospitalAffiliations.${i}.hospitalName`)} className={inputCls(!!fe(errors, "hospitalAffiliations", i, "hospitalName"))} />
                    <Err msg={fe(errors, "hospitalAffiliations", i, "hospitalName")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input {...register(`hospitalAffiliations.${i}.city`)} className={inputCls(!!fe(errors, "hospitalAffiliations", i, "city"))} />
                    <Err msg={fe(errors, "hospitalAffiliations", i, "city")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <select {...register(`hospitalAffiliations.${i}.state`)} className={selectCls(!!fe(errors, "hospitalAffiliations", i, "state"))}>
                      <option value="">Select…</option>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Err msg={fe(errors, "hospitalAffiliations", i, "state")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Privilege Type *</label>
                    <select {...register(`hospitalAffiliations.${i}.privilegeType`)} className={selectCls(!!fe(errors, "hospitalAffiliations", i, "privilegeType"))}>
                      <option value="">Select…</option>
                      {PRIVILEGE_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <Err msg={fe(errors, "hospitalAffiliations", i, "privilegeType")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date *</label>
                    <input type="date" {...register(`hospitalAffiliations.${i}.appointmentDate`)} className={inputCls(!!fe(errors, "hospitalAffiliations", i, "appointmentDate"))} />
                    <Err msg={fe(errors, "hospitalAffiliations", i, "appointmentDate")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Status *</label>
                    <select {...register(`hospitalAffiliations.${i}.currentStatus`)} className={selectCls(!!fe(errors, "hospitalAffiliations", i, "currentStatus"))}>
                      <option value="">Select…</option>
                      {AFFILIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Err msg={fe(errors, "hospitalAffiliations", i, "currentStatus")} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => hospitalItems.append({ ...emptyHospitalAffiliation })}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Hospital Affiliation
          </button>
          {typeof (errors as any)?.hospitalAffiliations?.message === "string" && (
            <Err msg={(errors as any).hospitalAffiliations.message} />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 8 — Licenses  (repeatable)                               */}
      {/* ================================================================ */}
      {section === 8 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">State Licenses</h3>
          <p className="text-sm text-gray-500">List all active and previously held state licenses. Mark your primary state of practice.</p>

          <div className="space-y-4 pt-1">
            {licenseItems.fields.map((field, i) => (
              <div key={field.id} className="relative border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
                {licenseItems.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => licenseItems.remove(i)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <select {...register(`licenses.${i}.state`)} className={selectCls(!!fe(errors, "licenses", i, "state"))}>
                      <option value="">Select…</option>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Err msg={fe(errors, "licenses", i, "state")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Type *</label>
                    <select {...register(`licenses.${i}.licenseType`)} className={selectCls(!!fe(errors, "licenses", i, "licenseType"))}>
                      <option value="">Select…</option>
                      {LICENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Err msg={fe(errors, "licenses", i, "licenseType")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
                    <input {...register(`licenses.${i}.licenseNumber`)} className={inputCls(!!fe(errors, "licenses", i, "licenseNumber"))} />
                    <Err msg={fe(errors, "licenses", i, "licenseNumber")} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" {...register(`licenses.${i}.isPrimary`)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      Primary state of practice
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
                    <input type="date" {...register(`licenses.${i}.issueDate`)} className={inputCls(!!fe(errors, "licenses", i, "issueDate"))} />
                    <Err msg={fe(errors, "licenses", i, "issueDate")} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
                    <input type="date" {...register(`licenses.${i}.expirationDate`)} className={inputCls(!!fe(errors, "licenses", i, "expirationDate"))} />
                    <Err msg={fe(errors, "licenses", i, "expirationDate")} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => licenseItems.append({ ...emptyLicense })}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add License
          </button>
          {typeof (errors as any)?.licenses?.message === "string" && (
            <Err msg={(errors as any).licenses.message} />
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 9 — Attestation & Signature                              */}
      {/* ================================================================ */}
      {section === 9 && (
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <h3 className="font-semibold text-gray-900 text-lg">Attestation & Signature</h3>

          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 leading-relaxed">
            Please read each statement below carefully. By checking each box, you acknowledge and agree to the terms.
            All boxes must be checked to submit your application.
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("attestTruthful")}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I hereby attest that all information provided in this application is <strong>true, complete, and correct</strong> to the best of my knowledge and belief. I understand that any misstatement in or omission from this application constitutes cause for denial of appointment or cause for summary dismissal.
              </span>
            </label>
            <Err msg={fe(errors, "attestTruthful")} />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("attestAuthorizeVerification")}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I <strong>authorize Essen Medical Associates</strong> and its designated agents to verify all statements made herein, including contacting prior and current employers, educational institutions, licensing boards, malpractice carriers, the National Practitioner Data Bank (NPDB), and any other relevant sources.
              </span>
            </label>
            <Err msg={fe(errors, "attestAuthorizeVerification")} />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("attestNotifyChanges")}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I agree to <strong>notify Essen Medical Associates promptly</strong> of any changes to the information provided, including but not limited to changes in licensure status, malpractice claims, disciplinary actions, health status, or any other matter that may affect my ability to practice.
              </span>
            </label>
            <Err msg={fe(errors, "attestNotifyChanges")} />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register("attestUnderstandFalsification")}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I understand that <strong>falsification, misrepresentation, or material omission</strong> of information on this application may result in denial of appointment, immediate termination, or revocation of clinical privileges, regardless of when such falsification is discovered.
              </span>
            </label>
            <Err msg={fe(errors, "attestUnderstandFalsification")} />
          </div>

          {/* Digital Signature */}
          <div className="border-t pt-6 mt-6 space-y-4">
            <h4 className="font-medium text-gray-900">Digital Signature</h4>
            <p className="text-sm text-gray-500">
              By typing your full legal name below, you agree that this constitutes your electronic signature.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Legal Name *</label>
                <input
                  {...register("signatureName")}
                  placeholder="Type your full legal name"
                  className={`${inputCls(!!errors.signatureName)} italic`}
                />
                <Err msg={fe(errors, "signatureName")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" {...register("signatureDate")} className={inputCls(!!errors.signatureDate)} />
                <Err msg={fe(errors, "signatureDate")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Navigation                                                       */}
      {/* ================================================================ */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={section === 0}
          className="px-6 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="submit"
          className={`px-6 py-2 rounded-lg text-sm font-medium text-white ${
            section === 9
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {section === 9 ? "Submit Application" : "Save & Continue"}
        </button>
      </div>
    </form>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
