# 0010. Pino for structured logs with PHI redaction

- Status: Accepted
- Date: 2026-04-16

## Context

HIPAA and internal policy forbid PHI in logs. The prior stack used `console.log` across the codebase, which:

- Produced unstructured text lines impossible to query.
- Had no redaction, so SSN / DOB could leak if a developer logged a full object.
- Prevented correlation across a request.

## Decision

Use `pino` as the only logger. Central config in `src/lib/logger.ts`:

- JSON lines in production; pretty output locally.
- A `redact.paths` list covering SSN, DOB, addresses, passwords, API keys, Authorization/Cookie headers.
- Standard error serializer for stack traces.
- Child loggers carry a request or job id.

Developers `import { logger, childLogger } from "@/lib/logger"`; `console.*` is banned by ESLint rule.

## Consequences

- Logs are queryable in Azure Monitor / any log aggregator.
- PHI leakage is a configuration issue, not a developer-memory issue.
- Every request has a correlation id for cross-service tracing.
- A unit test asserts the redaction actually masks known fields; new PHI requires updating both schema comment and redact paths in the same PR.

## Alternatives considered

- **Winston** — capable but noisier config; Pino's redaction path syntax is cleaner.
- **Console + structured JSON by hand** — error-prone; each dev could do it differently.
- **Azure Monitor SDK directly** — ties us to Azure at the application layer unnecessarily.
