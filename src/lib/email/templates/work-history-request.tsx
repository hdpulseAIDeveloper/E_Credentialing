import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface WorkHistoryRequestEmailProps {
  contactName?: string | null;
  employerName: string;
  providerName: string;
  responseUrl: string;
  isReminder?: boolean;
  position?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export function WorkHistoryRequestEmail({
  contactName,
  employerName,
  providerName,
  responseUrl,
  isReminder,
  position,
  startDate,
  endDate,
}: WorkHistoryRequestEmailProps) {
  const greeting = contactName ? `Dear ${contactName},` : `Hello,`;
  const subjectLine = isReminder
    ? `Reminder: employment verification request for ${providerName}`
    : `Employment verification request for ${providerName}`;

  return (
    <Html>
      <Head />
      <Preview>{subjectLine}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isReminder ? "Reminder: " : ""}
            Employment Verification Request
          </Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Essen Medical Associates is verifying the employment history of{" "}
            <strong>{providerName}</strong> as part of an active credentialing
            review. Our records indicate {providerName} was employed at{" "}
            <strong>{employerName}</strong>
            {position ? ` as ${position}` : ""}
            {startDate ? ` from ${startDate}` : ""}
            {endDate ? ` to ${endDate}` : startDate ? " to present" : ""}.
          </Text>
          <Text style={text}>
            Please confirm or correct this information using the secure link
            below. The form takes about two minutes and is required for NCQA-compliant
            primary source verification.
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={responseUrl}>
              Complete Verification Form
            </Button>
          </Section>
          <Text style={text}>
            If the button above does not work, copy and paste this URL into your
            browser:
          </Text>
          <Link href={responseUrl} style={link}>
            {responseUrl}
          </Link>
          <Hr style={hr} />
          <Text style={footer}>
            If you did not expect this request, please disregard this email or
            contact us at cred_onboarding@essenmed.com.
          </Text>
          <Text style={footer}>
            © Essen Medical Associates — Credentialing Department
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "580px",
};
const h1 = {
  color: "#1a1a2e",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "30px 0",
  padding: "0 48px",
};
const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 16px",
  padding: "0 48px",
};
const btnContainer = { padding: "8px 48px 24px" };
const button = {
  backgroundColor: "#1d4ed8",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
};
const link = {
  color: "#1d4ed8",
  fontSize: "14px",
  padding: "0 48px",
  wordBreak: "break-all" as const,
};
const hr = { borderColor: "#e5e7eb", margin: "26px 48px" };
const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  padding: "0 48px",
  margin: "4px 0",
};
