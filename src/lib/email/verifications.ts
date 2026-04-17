/**
 * Verification email helpers — work history & professional reference outreach.
 *
 * The React Email templates in src/lib/email/templates/ are component-only and
 * not rendered at runtime in this codebase. To avoid pulling in a new render
 * dependency, these helpers ship hand-built HTML for the two NCQA-required
 * outreach flows: work history verification and professional reference.
 *
 * Both emails contain a single magic link (responseToken) that the recipient
 * uses to submit their structured response without needing an account.
 */

import { sendEmail } from "./sendgrid";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:6015"
).replace(/\/+$/, "");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shellHtml(opts: { heading: string; body: string }): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(opts.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f9fc;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;max-width:580px;">
            <tr>
              <td style="padding:32px 48px 24px;">
                <h1 style="color:#1a1a2e;font-size:22px;font-weight:700;margin:0 0 24px;">${escapeHtml(opts.heading)}</h1>
                ${opts.body}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
                <p style="color:#6b7280;font-size:12px;line-height:18px;margin:4px 0;">
                  If you did not expect this email, please disregard it or contact us at
                  <a href="mailto:cred_onboarding@essenmed.com" style="color:#1d4ed8;">cred_onboarding@essenmed.com</a>.
                </p>
                <p style="color:#6b7280;font-size:12px;line-height:18px;margin:4px 0;">
                  &copy; Essen Medical Associates &mdash; Credentialing Department
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="text-align:center;margin:24px 0;">
    <a href="${escapeHtml(href)}"
       style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">
      ${escapeHtml(label)}
    </a>
  </p>
  <p style="color:#374151;font-size:14px;line-height:22px;margin:0 0 8px;">
    If the button above does not work, copy and paste this URL into your browser:
  </p>
  <p style="color:#1d4ed8;font-size:13px;line-height:20px;word-break:break-all;margin:0 0 24px;">
    <a href="${escapeHtml(href)}" style="color:#1d4ed8;">${escapeHtml(href)}</a>
  </p>`;
}

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// ─── Work History Verification ──────────────────────────────────────────────

export interface WorkHistoryEmailParams {
  to: string;
  contactName?: string | null;
  employerName: string;
  providerName: string;
  responseToken: string;
  isReminder?: boolean;
  position?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export async function sendWorkHistoryEmail(
  params: WorkHistoryEmailParams
): Promise<string> {
  const responseUrl = `${APP_URL}/verify/work-history/${params.responseToken}`;
  const greeting = params.contactName
    ? `Dear ${escapeHtml(params.contactName)},`
    : "Hello,";
  const heading = params.isReminder
    ? "Reminder: Employment Verification Request"
    : "Employment Verification Request";
  const subject = params.isReminder
    ? `Reminder: employment verification for ${params.providerName}`
    : `Employment verification for ${params.providerName}`;

  const startStr = fmtDate(params.startDate);
  const endStr = fmtDate(params.endDate);
  const datesPhrase =
    startStr && endStr
      ? ` from ${escapeHtml(startStr)} to ${escapeHtml(endStr)}`
      : startStr
        ? ` starting ${escapeHtml(startStr)}`
        : "";
  const positionPhrase = params.position
    ? ` as <strong>${escapeHtml(params.position)}</strong>`
    : "";

  const body = `
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">${greeting}</p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Essen Medical Associates is verifying the employment history of
      <strong>${escapeHtml(params.providerName)}</strong> as part of an active
      credentialing review. Our records indicate this provider was employed at
      <strong>${escapeHtml(params.employerName)}</strong>${positionPhrase}${datesPhrase}.
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Please confirm or correct this information using the secure link below. The
      form takes about two minutes and is required for NCQA-compliant primary
      source verification.
    </p>
    ${ctaButton(responseUrl, "Complete Verification Form")}
  `;

  return sendEmail({
    to: params.to,
    subject,
    html: shellHtml({ heading, body }),
    replyTo: "cred_onboarding@essenmed.com",
  });
}

// ─── Professional Reference ─────────────────────────────────────────────────

export interface ReferenceEmailParams {
  to: string;
  referenceName: string;
  providerName: string;
  responseToken: string;
  isReminder?: boolean;
  relationship?: string | null;
}

export async function sendReferenceEmail(
  params: ReferenceEmailParams
): Promise<string> {
  const responseUrl = `${APP_URL}/verify/reference/${params.responseToken}`;
  const heading = params.isReminder
    ? "Reminder: Professional Reference Request"
    : "Professional Reference Request";
  const subject = params.isReminder
    ? `Reminder: professional reference for ${params.providerName}`
    : `Professional reference request for ${params.providerName}`;

  const relPhrase = params.relationship
    ? ` (relationship: ${escapeHtml(params.relationship)})`
    : "";

  const body = `
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Dear ${escapeHtml(params.referenceName)},
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      <strong>${escapeHtml(params.providerName)}</strong> has listed you as a
      professional reference for credentialing with Essen Medical Associates${relPhrase}.
      As part of our NCQA-compliant credentialing process, we ask you to complete
      a brief structured reference form.
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      The form takes about three minutes and covers clinical competence,
      professionalism, and your overall recommendation. Your response is
      treated confidentially.
    </p>
    ${ctaButton(responseUrl, "Complete Reference Form")}
  `;

  return sendEmail({
    to: params.to,
    subject,
    html: shellHtml({ heading, body }),
    replyTo: "cred_onboarding@essenmed.com",
  });
}

// ─── Malpractice Carrier Verification (P1 Gap #12) ──────────────────────────

export interface CarrierEmailParams {
  to: string;
  contactName?: string | null;
  carrierName: string;
  providerName: string;
  responseToken: string;
  isReminder?: boolean;
  policyNumber?: string | null;
  expectedExpDate?: Date | string | null;
}

export async function sendCarrierVerificationEmail(
  params: CarrierEmailParams
): Promise<string> {
  const responseUrl = `${APP_URL}/verify/carrier/${params.responseToken}`;
  const greeting = params.contactName
    ? `Dear ${escapeHtml(params.contactName)},`
    : "To Whom It May Concern,";
  const heading = params.isReminder
    ? "Reminder: Malpractice Coverage Verification Request"
    : "Malpractice Coverage Verification Request";
  const subject = params.isReminder
    ? `Reminder: malpractice coverage verification for ${params.providerName}`
    : `Malpractice coverage verification for ${params.providerName}`;

  const policyPhrase = params.policyNumber
    ? `, policy number <strong>${escapeHtml(params.policyNumber)}</strong>`
    : "";
  const expStr = fmtDate(params.expectedExpDate);
  const expPhrase = expStr ? ` with expiration on or about ${escapeHtml(expStr)}` : "";

  const body = `
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">${greeting}</p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Essen Medical Associates is performing primary source verification of
      malpractice coverage for <strong>${escapeHtml(params.providerName)}</strong>
      under <strong>${escapeHtml(params.carrierName)}</strong>${policyPhrase}${expPhrase}.
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Please confirm the policy details (per-occurrence and aggregate limits,
      effective and expiration dates, claims history) using the secure link
      below. The form takes about two minutes and is required for NCQA-compliant
      credentialing.
    </p>
    ${ctaButton(responseUrl, "Complete Coverage Verification")}
  `;

  return sendEmail({
    to: params.to,
    subject,
    html: shellHtml({ heading, body }),
    replyTo: "cred_onboarding@essenmed.com",
  });
}

// ─── CAQH Re-attestation Reminder (P1 Gap #14) ──────────────────────────────

export interface CaqhReminderEmailParams {
  to: string;
  providerName: string;
  daysUntilDue: number;
  dueDate: Date;
  caqhId?: string | null;
}

export async function sendCaqhReattestationReminder(
  params: CaqhReminderEmailParams
): Promise<string> {
  const dueStr = fmtDate(params.dueDate) ?? "";
  const heading =
    params.daysUntilDue <= 0
      ? "URGENT: CAQH re-attestation overdue"
      : params.daysUntilDue <= 14
        ? `Action needed: CAQH re-attestation due in ${params.daysUntilDue} days`
        : "Reminder: CAQH re-attestation coming up";
  const subject = heading;
  const caqhStr = params.caqhId ? ` (CAQH ID: ${escapeHtml(params.caqhId)})` : "";

  const body = `
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Hello ${escapeHtml(params.providerName)},
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      CAQH ProView requires you to re-attest your profile every 120 days.
      Your next re-attestation${caqhStr} is due on
      <strong>${escapeHtml(dueStr)}</strong>
      ${
        params.daysUntilDue <= 0
          ? "(<strong style=\"color:#b91c1c;\">overdue</strong>)."
          : `(in <strong>${params.daysUntilDue}</strong> day${params.daysUntilDue === 1 ? "" : "s"}).`
      }
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Until you re-attest, several payers will treat your profile as stale and
      can pause new claims, slow down recredentialing, and delay enrollment
      updates. The process takes only a few minutes.
    </p>
    ${ctaButton("https://proview.caqh.org/", "Open CAQH ProView")}
    <p style="color:#6b7280;font-size:13px;line-height:20px;margin:8px 0 0;">
      Questions? Reply to this email and the Essen credentialing team will
      help.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject,
    html: shellHtml({ heading, body }),
    replyTo: "cred_onboarding@essenmed.com",
  });
}

// ─── Staff training reminders (P2 Gap #18) ────────────────────────────────

export interface TrainingReminderParams {
  to: string;
  staffName: string;
  courseTitle: string;
  dueDate: Date;
  daysUntilDue: number; // negative when overdue
  trainingPortalUrl: string;
}

export async function sendStaffTrainingReminder(
  params: TrainingReminderParams
): Promise<string> {
  const dueStr = fmtDate(params.dueDate) ?? "";
  const heading =
    params.daysUntilDue <= 0
      ? `OVERDUE: required training "${params.courseTitle}"`
      : params.daysUntilDue <= 7
        ? `Action needed: "${params.courseTitle}" due in ${params.daysUntilDue} day${params.daysUntilDue === 1 ? "" : "s"}`
        : `Reminder: required training "${params.courseTitle}"`;

  const body = `
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Hello ${escapeHtml(params.staffName)},
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      NCQA and HIPAA require all credentialing staff to complete the
      <strong>${escapeHtml(params.courseTitle)}</strong> course on the
      assigned cadence. Your assignment is due on
      <strong>${escapeHtml(dueStr)}</strong>
      ${
        params.daysUntilDue <= 0
          ? "(<strong style=\"color:#b91c1c;\">overdue</strong>)."
          : `(in <strong>${params.daysUntilDue}</strong> day${params.daysUntilDue === 1 ? "" : "s"}).`
      }
    </p>
    <p style="color:#374151;font-size:16px;line-height:26px;margin:0 0 16px;">
      Open the staff training portal to complete the course and upload your
      certificate of completion.
    </p>
    ${ctaButton(params.trainingPortalUrl, "Open Staff Training")}
  `;

  return sendEmail({
    to: params.to,
    subject: heading,
    html: shellHtml({ heading, body }),
    replyTo: "cred_onboarding@essenmed.com",
  });
}

// ─── Optional global toggle ─────────────────────────────────────────────────
// If SENDGRID_API_KEY is missing, we soft-fail rather than crash the mutation.
// The router records whether email was actually delivered.

export interface VerificationEmailResult {
  delivered: boolean;
  messageId: string | null;
  reason?: string;
}

export async function tryEmail(
  fn: () => Promise<string>
): Promise<VerificationEmailResult> {
  if (!process.env.SENDGRID_API_KEY) {
    return {
      delivered: false,
      messageId: null,
      reason: "SENDGRID_API_KEY not configured; email skipped.",
    };
  }
  try {
    const id = await fn();
    return { delivered: true, messageId: id };
  } catch (err) {
    console.error("[Verifications] SendGrid error:", err);
    return {
      delivered: false,
      messageId: null,
      reason: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
