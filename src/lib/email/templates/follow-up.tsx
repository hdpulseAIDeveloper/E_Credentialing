import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface FollowUpEmailProps {
  providerName: string;
  appUrl: string;
  missingItems?: string[];
  followUpNumber?: number;
}

export function FollowUpEmail({
  providerName,
  appUrl,
  missingItems = [],
  followUpNumber = 1,
}: FollowUpEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Action required: Complete your credentialing application</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Credentialing Application Reminder</Heading>
          <Text style={text}>Dear {providerName},</Text>
          <Text style={text}>
            This is a reminder that your Essen Medical credentialing application
            requires your attention. Please log in to complete the outstanding
            items.
          </Text>
          {missingItems.length > 0 && (
            <Section style={itemsSection}>
              <Text style={boldText}>Outstanding Items:</Text>
              {missingItems.map((item, i) => (
                <Text key={i} style={listItem}>
                  • {item}
                </Text>
              ))}
            </Section>
          )}
          <Section style={btnContainer}>
            <Button style={button} href={appUrl}>
              Continue Application
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            If you have questions, contact us at cred_onboarding@essenmed.com.
          </Text>
          <Text style={footer}>
            Follow-up #{followUpNumber} — © Essen Medical Associates
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "20px 0 48px", maxWidth: "580px" };
const h1 = { color: "#1a1a2e", fontSize: "22px", fontWeight: "700", padding: "0 48px", margin: "30px 0" };
const text = { color: "#374151", fontSize: "16px", lineHeight: "26px", padding: "0 48px", margin: "0 0 16px" };
const boldText = { ...text, fontWeight: "700" };
const itemsSection = { padding: "0 48px" };
const listItem = { color: "#374151", fontSize: "15px", margin: "4px 0", paddingLeft: "16px" };
const btnContainer = { padding: "8px 48px 24px" };
const button = { backgroundColor: "#1d4ed8", borderRadius: "6px", color: "#fff", display: "inline-block", fontSize: "16px", fontWeight: "600", padding: "12px 24px", textDecoration: "none" };
const hr = { borderColor: "#e5e7eb", margin: "26px 48px" };
const footer = { color: "#6b7280", fontSize: "12px", padding: "0 48px", margin: "4px 0" };
