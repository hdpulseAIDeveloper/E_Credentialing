# Runbooks

Operational playbooks for recurring tasks and incidents. Each runbook:

- Starts with **Symptoms** so you can decide quickly if this is the right doc.
- Has a **Procedure** you can follow under pressure.
- Ends with **Validation** so you know you're done.

## Index

| Runbook | Symptom | Audience |
|---------|---------|----------|
| [Bot outage](bot-outage.md) | All bot runs of one type are failing | On-call engineer |
| [Stuck job](stuck-job.md) | Jobs sit in QUEUED forever | On-call engineer |
| [Web container won't start](web-start-failure.md) | Container restarts in a loop | On-call engineer |
| [DB migration failure](migration-failure.md) | `prisma migrate deploy` fails at boot | On-call engineer |
| [Key rotation](key-rotation.md) | Annual encryption key rotation | Admin + on-call |
| [Rollback](rollback.md) | Need to revert a deploy | On-call engineer |
| [Incident response](incident-response.md) | Something is broken and customers notice | All |
| [Access request](access-request.md) | Provision a new staff user | Admin |
| [Schemathesis fuzz](schemathesis-fuzz.md) | Validate the public REST v1 surface against its OpenAPI 3.1 spec | API engineer |
| [SDK generation](sdk-generation.md) | Regenerate the TypeScript SDK or vendor a Python SDK from the spec | API engineer |

See also: [Deployment](../deployment.md), [Observability](../observability.md).
