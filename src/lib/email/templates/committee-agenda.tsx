import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Row, Column,
} from "@react-email/components";
import * as React from "react";

interface AgendaProvider {
  order: number;
  name: string;
  providerType: string;
  daysWaiting: number;
}

interface CommitteeAgendaEmailProps {
  sessionDate: string;
  sessionTime?: string;
  location?: string;
  providers: AgendaProvider[];
  agendaUrl?: string;
}

export function CommitteeAgendaEmail({
  sessionDate,
  sessionTime,
  location,
  providers,
  agendaUrl,
}: CommitteeAgendaEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Committee Agenda — {sessionDate}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Credentialing Committee Agenda</Heading>
          <Text style={text}><strong>Date:</strong> {sessionDate}</Text>
          {sessionTime && <Text style={text}><strong>Time:</strong> {sessionTime}</Text>}
          {location && <Text style={text}><strong>Location:</strong> {location}</Text>}
          <Hr style={hr} />
          <Text style={{ ...text, fontWeight: "700", marginBottom: "8px" }}>
            Providers for Review ({providers.length}):
          </Text>
          {providers.map((p) => (
            <Section key={p.order} style={providerRow}>
              <Text style={providerText}>
                {p.order}. {p.name} ({p.providerType}) — {p.daysWaiting} days waiting
              </Text>
            </Section>
          ))}
          {agendaUrl && (
            <>
              <Hr style={hr} />
              <Text style={text}>
                Full agenda PDF: <a href={agendaUrl} style={link}>{agendaUrl}</a>
              </Text>
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>© Essen Medical Associates — Credentialing Department</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "20px 0 48px", maxWidth: "620px" };
const h1 = { color: "#1a1a2e", fontSize: "22px", fontWeight: "700", padding: "0 48px", margin: "30px 0" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", padding: "0 48px", margin: "0 0 8px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 48px" };
const providerRow = { padding: "4px 48px" };
const providerText = { color: "#374151", fontSize: "14px", margin: "2px 0" };
const link = { color: "#1d4ed8" };
const footer = { color: "#6b7280", fontSize: "12px", padding: "0 48px" };
