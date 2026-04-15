import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface ExpirableAlertEmailProps {
  providerName: string;
  expirableType: string;
  expirationDate: string;
  daysUntilExpiry: number;
  renewalUrl: string;
}

export function ExpirableAlertEmail({ providerName, expirableType, expirationDate, daysUntilExpiry, renewalUrl }: ExpirableAlertEmailProps) {
  const isUrgent = daysUntilExpiry <= 14;

  return (
    <Html>
      <Head />
      <Preview>{isUrgent ? "URGENT: " : ""}Credential expiring: {expirableType}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ ...h1, color: isUrgent ? "#dc2626" : "#92400e" }}>
            {isUrgent ? "URGENT: " : ""}Credential Expiring Soon
          </Heading>
          <Text style={text}>Dear {providerName},</Text>
          <Text style={text}>
            Your <strong>{expirableType}</strong> expires on <strong>{expirationDate}</strong> — that is <strong>{daysUntilExpiry} days away</strong>. Please take action to renew it promptly.
          </Text>
          <Section style={btnContainer}>
            <Button style={{ ...button, backgroundColor: isUrgent ? "#dc2626" : "#d97706" }} href={renewalUrl}>
              Renew Now
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>© Essen Medical Associates — Credentialing Department</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#fffbeb", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "20px 0 48px", maxWidth: "580px" };
const h1 = { fontSize: "22px", fontWeight: "700", padding: "0 48px", margin: "30px 0" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", padding: "0 48px", margin: "0 0 12px" };
const btnContainer = { padding: "8px 48px 20px" };
const button = { borderRadius: "6px", color: "#fff", display: "inline-block", fontSize: "15px", fontWeight: "600", padding: "10px 20px", textDecoration: "none" };
const hr = { borderColor: "#e5e7eb", margin: "20px 48px" };
const footer = { color: "#6b7280", fontSize: "12px", padding: "0 48px" };
