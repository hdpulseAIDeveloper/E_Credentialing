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

interface ProviderInviteEmailProps {
  providerName: string;
  inviteUrl: string;
  specialistName: string;
  expiresHours?: number;
}

export function ProviderInviteEmail({
  providerName,
  inviteUrl,
  specialistName,
  expiresHours = 72,
}: ProviderInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Complete your Essen Medical credentialing application</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to Essen Medical Credentialing</Heading>
          <Text style={text}>Dear {providerName},</Text>
          <Text style={text}>
            We are pleased to invite you to complete your credentialing
            application with Essen Medical. Your assigned credentialing
            specialist, {specialistName}, has initiated your onboarding process.
          </Text>
          <Text style={text}>
            Please click the button below to create your account and begin your
            application. This link will expire in {expiresHours} hours.
          </Text>
          <Section style={btnContainer}>
            <Button style={button} href={inviteUrl}>
              Begin Credentialing Application
            </Button>
          </Section>
          <Text style={text}>
            If the button above does not work, copy and paste this URL into your
            browser:
          </Text>
          <Link href={inviteUrl} style={link}>
            {inviteUrl}
          </Link>
          <Hr style={hr} />
          <Text style={footer}>
            If you have questions, please contact your credentialing specialist
            at cred_onboarding@essenmed.com.
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
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
  fontWeight: "700",
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

const btnContainer = {
  padding: "8px 48px 24px",
};

const button = {
  backgroundColor: "#1d4ed8",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
};

const link = {
  color: "#1d4ed8",
  fontSize: "14px",
  padding: "0 48px",
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "26px 48px",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  padding: "0 48px",
  margin: "4px 0",
};
