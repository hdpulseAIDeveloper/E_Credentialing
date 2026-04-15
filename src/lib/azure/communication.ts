/**
 * Azure Communication Services SMS client.
 * Used for provider outreach and reminders.
 */

import { SmsClient } from "@azure/communication-sms";

let _smsClient: SmsClient | null = null;

function getSmsClient(): SmsClient {
  if (_smsClient) return _smsClient;

  const connectionString = process.env.AZURE_COMMUNICATION_SERVICES_ENDPOINT;
  if (!connectionString) {
    throw new Error("AZURE_COMMUNICATION_SERVICES_ENDPOINT is not set");
  }

  _smsClient = new SmsClient(connectionString);
  return _smsClient;
}

export interface SmsResult {
  messageId: string;
  httpStatusCode: number;
  errorMessage?: string;
  successful: boolean;
}

/**
 * Sends an SMS message to a recipient phone number.
 * The from number must be provisioned in Azure Communication Services.
 */
export async function sendSms(params: {
  to: string;
  message: string;
}): Promise<SmsResult> {
  const client = getSmsClient();
  const fromNumber = process.env.AZURE_COMMUNICATION_FROM_PHONE ?? "+12125550001";

  const results = await client.send({
    from: fromNumber,
    to: [params.to],
    message: params.message,
  });

  const result = results[0];
  if (!result) {
    throw new Error("No SMS send result returned");
  }

  return {
    messageId: result.messageId ?? "",
    httpStatusCode: result.httpStatusCode,
    errorMessage: result.errorMessage,
    successful: result.successful,
  };
}

/**
 * Sends a provider invite SMS with the magic link.
 */
export async function sendProviderInviteSms(params: {
  to: string;
  providerName: string;
  inviteUrl: string;
}): Promise<SmsResult> {
  const message =
    `Hi ${params.providerName}, Essen Medical has invited you to complete your credentialing application. ` +
    `Please click the link to begin: ${params.inviteUrl}. ` +
    `This link expires in 72 hours.`;

  return sendSms({ to: params.to, message });
}

/**
 * Sends a follow-up SMS reminder to a provider.
 */
export async function sendProviderReminderSms(params: {
  to: string;
  providerName: string;
  appUrl: string;
}): Promise<SmsResult> {
  const message =
    `Hi ${params.providerName}, this is a reminder to complete your Essen Medical credentialing application. ` +
    `Please log in at ${params.appUrl} to continue. Reply STOP to opt out.`;

  return sendSms({ to: params.to, message });
}
