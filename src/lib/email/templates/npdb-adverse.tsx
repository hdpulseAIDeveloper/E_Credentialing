import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface NpdbAdverseEmailProps {
  providerName: string;
  queryDate: string;
  reportCount: number;
  dashboardUrl: string;
}

export function NpdbAdverseEmail({ providerName, queryDate, reportCount, dashboardUrl }: NpdbAdverseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>ALERT: NPDB adverse reports found for {providerName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>ALERT: NPDB Adverse Reports Found</Heading>
          <Text style={text}>An NPDB query has returned adverse reports requiring review:</Text>
          <Section style={alertBox}>
            <Text style={alertText}><strong>Provider:</strong> {providerName}</Text>
            <Text style={alertText}><strong>Query Date:</strong> {queryDate}</Text>
            <Text style={alertText}><strong>Reports Found:</strong> {reportCount}</Text>
          </Section>
          <Text style={text}>Please review the full NPDB report in the credentialing platform. <a href={dashboardUrl} style={link}>View Reports</a></Text>
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
