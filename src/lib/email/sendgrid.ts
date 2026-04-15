/**
 * SendGrid email client.
 * All transactional emails for staff and providers go through this module.
 */

import sgMail from "@sendgrid/mail";

let initialized = false;

function initSendGrid(): void {
  if (initialized) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set");
  }

  sgMail.setApiKey(apiKey);
  initialized = true;
}

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "cred_onboarding@essenmed.com";
const FROM_NAME = "Essen Credentialing";

/**
 * Sends an email via SendGrid.
 * Returns the message ID from the response headers.
 */
export async function sendEmail(params: EmailParams): Promise<string> {
  initSendGrid();

  const msg: Parameters<typeof sgMail.send>[0] = {
    to: params.to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: params.subject,
    html: params.html,
    text: params.text ?? stripHtml(params.html),
    ...(params.replyTo && { replyTo: params.replyTo }),
  };

  const [response] = await sgMail.send(msg);
  return (response.headers["x-message-id"] as string) ?? "";
}

/**
 * Sends an email using a SendGrid dynamic template.
 */
export async function sendTemplatedEmail(params: {
  to: string | string[];
  templateId: string;
  dynamicTemplateData: Record<string, unknown>;
}): Promise<string> {
  initSendGrid();

  const msg = {
    to: params.to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    templateId: params.templateId,
    dynamicTemplateData: params.dynamicTemplateData,
  };

  const [response] = await sgMail.send(msg);
  return (response.headers["x-message-id"] as string) ?? "";
}

/**
 * Very simple HTML stripper for generating text fallback.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
