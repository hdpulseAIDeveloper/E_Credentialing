import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from "@react-email/components";
import * as React from "react";

interface TaskAssignedEmailProps {
  recipientName: string;
  taskTitle: string;
  providerName: string;
  priority: string;
  dueDate?: string;
  taskUrl: string;
}

export function TaskAssignedEmail({ recipientName, taskTitle, providerName, priority, dueDate, taskUrl }: TaskAssignedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New task assigned: {taskTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New Task Assigned</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>A new task has been assigned to you:</Text>
          <Section style={taskBox}>
            <Text style={taskTitle_}><strong>{taskTitle}</strong></Text>
            <Text style={meta}>Provider: {providerName}</Text>
            <Text style={meta}>Priority: <span style={{ color: priorityColor(priority) }}>{priority.toUpperCase()}</span></Text>
            {dueDate && <Text style={meta}>Due: {dueDate}</Text>}
          </Section>
          <Section style={btnContainer}>
            <Button style={button} href={taskUrl}>View Task</Button>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>© Essen Medical Associates — Credentialing Platform</Text>
        </Container>
      </Body>
    </Html>
  );
}

function priorityColor(priority: string): string {
  if (priority === "high") return "#dc2626";
  if (priority === "medium") return "#d97706";
  return "#6b7280";
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { backgroundColor: "#fff", margin: "0 auto", padding: "20px 0 48px", maxWidth: "580px" };
const h1 = { color: "#1a1a2e", fontSize: "22px", fontWeight: "700", padding: "0 48px", margin: "30px 0" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", padding: "0 48px", margin: "0 0 12px" };
const taskBox = { backgroundColor: "#f3f4f6", borderRadius: "8px", margin: "0 48px 20px", padding: "16px" };
const taskTitle_ = { color: "#111827", fontSize: "16px", margin: "0 0 8px" };
const meta = { color: "#6b7280", fontSize: "14px", margin: "4px 0" };
const btnContainer = { padding: "0 48px 16px" };
const button = { backgroundColor: "#1d4ed8", borderRadius: "6px", color: "#fff", display: "inline-block", fontSize: "15px", fontWeight: "600", padding: "10px 20px", textDecoration: "none" };
const hr = { borderColor: "#e5e7eb", margin: "20px 48px" };
const footer = { color: "#6b7280", fontSize: "12px", padding: "0 48px" };
