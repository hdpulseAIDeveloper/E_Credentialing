import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface BotFailureEmailProps {
  botType: string;
  providerName: string;
  errorMessage: string;
  botRunId: string;
  dashboardUrl: string;
}

export function BotFailureEmail({ botType, providerName, errorMessage, botRunId, dashboardUrl }: BotFailureEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Bot failure alert: {botType} for {providerName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>PSV Bot Failure Alert</Heading>
          <Text style={text}>A bot run has failed and requires manual intervention:</Text>
          <Section style={alertBox}>
            <Text style={alertText}><strong>Bot:</strong> {botType}</Text>
            <Text style={alertText}><strong>Provider:</strong> {providerName}</Text>
            <Text style={alertText}><strong>Bot Run ID:</strong> {botRunId}</Text>
            <Text style={alertText}><strong>Error:</strong> {errorMessage}</Text>
          </Section>
          <Text style={text}>Please log in to the credentialing platform to review and retry.</Text>
          <Text style={text}><a href={dashboardUrl} style={link}>View Dashboard</a></Text>
          <Hr style={hr} />
          <Text style={footer}>© Essen Medical Associates — Credentialing Platform (Automated Alert)</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#fef2f2", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "20px 0 48px", maxWidth: "580px" };
const h1 = { color: "#991b1b", fontSize: "22px", fontWeight: "700", padding: "0 48px", margin: "30px 0" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", padding: "0 48px", margin: "0 0 12px" };
const alertBox = { backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", margin: "0 48px 20px", padding: "16px" };
const alertText = { color: "#7f1d1d", fontSize: "14px", margin: "4px 0" };
const link = { color: "#1d4ed8" };
const hr = { borderColor: "#e5e7eb", margin: "20px 48px" };
const footer = { color: "#6b7280", fontSize: "12px", padding: "0 48px" };
