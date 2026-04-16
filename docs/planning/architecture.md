# ESSEN Credentialing Platform — Architecture & Tech Stack

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Recommended — Pending final approval before implementation begins

---

## Recommendation Summary

**Recommended stack**: Next.js (TypeScript) + PostgreSQL + Azure

**Single language across the entire stack** (TypeScript). Playwright — the bot automation framework — is Node.js-native. Azure SDKs for Node.js are mature. The result is one team, one language, and a deployment model that fits neatly into Essen's existing Microsoft/Azure infrastructure.

---

## Stack Decision

### Why Not the Alternatives

| Alternative | Why Not Recommended |
|-------------|-------------------|
| **React + Express + PostgreSQL** | Splits frontend and backend into two separate projects with no meaningful benefit over Next.js for this use case. Adds operational complexity with no architectural gain. |
| **Python FastAPI + React + PostgreSQL** | Introduces two languages. Python Playwright exists but the Node.js version is more actively maintained and better documented. Azure SDKs are stronger in TypeScript. The only Python advantage (automation scripting) is matched by Node.js for this use case. |
| **Rails / Laravel / Django** | No significant advantage; introduces a language the dev team would need to learn for the bot layer. |

### Why Next.js + TypeScript

1. **One language end-to-end** — TypeScript for the UI, API routes, background jobs, and bots. No context switching between Python and JavaScript.
2. **Playwright is native Node.js** — PSV bots use Playwright's primary supported runtime.
3. **Prisma ORM** — type-safe database queries that mirror the data model exactly; schema migrations baked in.
4. **Azure alignment** — Azure SDKs for Node.js (Blob, Key Vault, AD, AI Document Intelligence, Communication Services) are production-grade and well-documented.
5. **BullMQ** — Redis-backed job queue purpose-built for Node.js; supports priorities, retries, rate limiting, and scheduled jobs — exactly what the bot infrastructure needs.
6. **Auth.js (NextAuth v5)** — built-in Microsoft Entra ID (Azure AD) provider; handles the OAuth 2.0 / OIDC flow with minimal configuration.
7. **tRPC** — type-safe API layer between Next.js frontend and backend; eliminates a whole class of runtime type errors at the API boundary.

---

## Full Technology Stack

### Application Layer

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | **Next.js** | 14+ (App Router) | Full-stack web framework — UI + API routes |
| Language | **TypeScript** | 5+ | Type-safe JavaScript across entire codebase |
| API layer | **tRPC** | v11 | Type-safe API between client and server |
| ORM | **Prisma** | 5+ | Type-safe database access + schema migrations |
| Auth | **Auth.js (NextAuth v5)** | v5 | Azure AD SSO + provider session management |
| UI components | **shadcn/ui** | Latest | Accessible, unstyled component library |
| Styling | **Tailwind CSS** | v3 | Utility-first CSS |
| Data fetching | **TanStack Query** | v5 | Server state management + caching |
| Real-time | **Socket.io** | v4 | WebSocket server for live bot status updates |
| Forms | **React Hook Form + Zod** | Latest | Form state management + schema validation |
| PDF generation | **React PDF / pdf-lib** | Latest | Generate committee agendas and summary sheets |
| Date handling | **date-fns** | v3 | Date arithmetic (expirables, cadences) |
| TOTP | **otplib** | Latest | RFC 6238 TOTP code generation for DEA MFA |
| Email templates | **React Email** | Latest | HTML email templates for outreach and alerts |

### Bot / Worker Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Browser automation | **Playwright** | PSV bots — headless Chromium for all web scraping |
| Job queue | **BullMQ** | Bot scheduling, retries, rate limiting, prioritization |
| Queue storage | **Redis** | BullMQ backing store |
| SFTP client | **ssh2-sftp-client** | FTP enrollment submissions |
| PDF manipulation | **pdf-lib** | Timestamp overlays on bot-generated PDFs |

### Data Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | **PostgreSQL 16** | Primary relational database |
| Migrations | **Prisma Migrate** | Schema versioning and migration |
| Encryption | **AES-256-GCM** (Node.js crypto) | PHI field encryption at application layer |
| Caching | **Redis** | Job queue + optional API response caching |

### Azure Services

| Azure Service | Purpose | SDK |
|--------------|---------|-----|
| **Azure AD / Entra ID** | Staff SSO authentication | Auth.js Microsoft provider |
| **Azure Blob Storage** | All file storage (documents, PDFs, bot output) | `@azure/storage-blob` |
| **Azure Key Vault** | All secrets (API keys, bot credentials, TOTP) | `@azure/keyvault-secrets` |
| **Azure AI Document Intelligence** | OCR for credential document auto-population | `@azure/ai-form-recognizer` |
| **Azure Communication Services** | SMS reminders to providers | `@azure/communication-sms` |
| **Azure Container Registry** | Docker image repository | Azure CLI |
| **Azure Container Apps** | Application and worker hosting | Azure CLI / Bicep |
| **Azure Database for PostgreSQL** | Managed PostgreSQL (Flexible Server) | Native PostgreSQL protocol |
| **Azure Cache for Redis** | Managed Redis for BullMQ | `ioredis` |
| **Azure Monitor + App Insights** | Logging, metrics, alerting | `applicationinsights` |

### Email

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Email delivery | **SendGrid** | Transactional email (outreach, alerts, agenda) |
| Email templates | **React Email** | HTML email template authoring |
| Delivery tracking | SendGrid webhooks | Track delivery, opens, bounces |

---

## System Architecture

### Deployment Architecture

The platform is split into two containerized services:

```
┌─────────────────────────────────────────────────────────┐
│                   Azure Container Apps                   │
│                                                          │
│  ┌──────────────────────┐  ┌───────────────────────┐    │
│  │     Web Container    │  │    Worker Container   │    │
│  │                      │  │                       │    │
│  │  Next.js App         │  │  BullMQ Workers       │    │
│  │  ├── UI (React)      │  │  ├── PSV Bots         │    │
│  │  ├── API Routes      │  │  │   (Playwright)      │    │
│  │  ├── tRPC Router     │  │  ├── Enrollment Bots   │    │
│  │  ├── Auth.js         │  │  ├── Sanctions Jobs    │    │
│  │  └── Socket.io       │  │  ├── Expirables Jobs   │    │
│  │      (real-time)     │  │  └── Scheduled Jobs    │    │
│  └──────────┬───────────┘  └──────────┬────────────┘    │
│             │                         │                  │
└─────────────┼─────────────────────────┼──────────────────┘
              │                         │
    ┌─────────┴─────────────────────────┴──────────┐
    │               Azure Services                  │
    │                                               │
    │  ┌─────────────┐  ┌──────────────┐           │
    │  │  PostgreSQL  │  │    Redis     │           │
    │  │ (Flexible    │  │ (Cache for   │           │
    │  │  Server)     │  │  Redis)      │           │
    │  └─────────────┘  └──────────────┘           │
    │                                               │
    │  ┌─────────────┐  ┌──────────────┐           │
    │  │    Blob      │  │  Key Vault   │           │
    │  │   Storage    │  │  (Secrets)   │           │
    │  └─────────────┘  └──────────────┘           │
    │                                               │
    │  ┌─────────────┐  ┌──────────────┐           │
    │  │  Azure AD   │  │  Document    │           │
    │  │  (Auth)     │  │ Intelligence │           │
    │  └─────────────┘  └──────────────┘           │
    └───────────────────────────────────────────────┘
```

### Request Flow

```
Provider / Staff Browser
        │
        ▼
Azure Front Door (optional CDN / WAF)
        │
        ▼
Azure Container Apps — Web Container
  ├── Static assets (served by Next.js)
  ├── API requests → tRPC router → Prisma → PostgreSQL
  ├── Auth flow → Auth.js → Azure AD
  ├── File uploads → Azure Blob Storage (server-side upload)
  └── Real-time → Socket.io ← Worker Container publishes events
        │
        ▼ (job enqueued)
Azure Cache for Redis (BullMQ queue)
        │
        ▼
Azure Container Apps — Worker Container
  ├── BullMQ worker pulls jobs
  ├── Bot runs → Playwright → External websites
  ├── Bot results → Prisma → PostgreSQL
  ├── Bot PDFs → Azure Blob Storage
  └── Events → Socket.io → Web Container → Browser (real-time)
```

### Real-Time Update Architecture

Bot status updates are pushed to the browser in real-time so staff can watch verification results populate without refreshing the page.

```
Worker Container                Web Container             Browser
      │                               │                      │
      │  Job completes                │                      │
      │  (e.g., license verified)     │                      │
      │                               │                      │
      │─── Redis Pub/Sub ────────────►│                      │
      │    event: bot.completed       │                      │
      │    payload: {providerId,      │                      │
      │      credentialType, status}  │                      │
      │                               │──── Socket.io ──────►│
      │                               │    emit to room:      │
      │                               │    provider:{id}      │
      │                               │                      │
      │                               │              UI updates
      │                               │              checklist in real-time
```

---

## Repository Structure

```
prjApp-Credentialing/
├── CLAUDE.md
├── docs/
│   ├── upload/                        # Source requirement documents
│   └── planning/                      # Planning documents (this file's directory)
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── (auth)/                    # Auth routes (login, callback)
│   │   ├── (staff)/                   # Staff-facing pages (protected)
│   │   │   ├── dashboard/             # Onboarding dashboard
│   │   │   ├── providers/[id]/        # Provider detail page
│   │   │   ├── committee/             # Committee dashboard
│   │   │   ├── enrollments/           # Enrollment management
│   │   │   ├── expirables/            # Expirables tracking
│   │   │   └── admin/                 # Admin panel
│   │   ├── (provider)/                # Provider-facing pages (external auth)
│   │   │   └── application/           # Application form + document upload
│   │   └── api/
│   │       ├── trpc/[trpc]/           # tRPC handler
│   │       ├── auth/[...nextauth]/    # Auth.js handler
│   │       └── webhooks/              # Incoming webhooks (SendGrid, iCIMS, NPDB)
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/               # tRPC routers (one per module)
│   │   │   │   ├── provider.ts
│   │   │   │   ├── document.ts
│   │   │   │   ├── committee.ts
│   │   │   │   ├── enrollment.ts
│   │   │   │   ├── expirable.ts
│   │   │   │   ├── sanctions.ts
│   │   │   │   ├── npdb.ts
│   │   │   │   ├── bot.ts
│   │   │   │   └── admin.ts
│   │   │   └── root.ts                # Root tRPC router
│   │   ├── auth.ts                    # Auth.js config (Azure AD provider)
│   │   └── db.ts                      # Prisma client singleton
│   ├── workers/
│   │   ├── index.ts                   # BullMQ worker entry point
│   │   ├── queues.ts                  # Queue definitions
│   │   ├── bots/
│   │   │   ├── license-verification.ts
│   │   │   ├── dea-verification.ts
│   │   │   ├── board-nccpa.ts
│   │   │   ├── board-abim.ts
│   │   │   ├── board-abfm.ts
│   │   │   ├── sanctions-oig.ts
│   │   │   ├── sanctions-sam.ts
│   │   │   ├── npdb-query.ts
│   │   │   ├── emedral-enrollment.ts
│   │   │   └── enrollment-portal.ts
│   │   └── jobs/
│   │       ├── expirables-scan.ts     # Nightly expirables check
│   │       ├── sanctions-monthly.ts   # Monthly sanctions recheck
│   │       └── follow-up-cadence.ts   # Enrollment follow-up alerts
│   ├── lib/
│   │   ├── azure/
│   │   │   ├── blob.ts                # Azure Blob Storage client
│   │   │   ├── keyvault.ts            # Azure Key Vault client
│   │   │   ├── document-intelligence.ts # OCR client
│   │   │   └── communication.ts       # SMS client
│   │   ├── email/
│   │   │   ├── sendgrid.ts            # SendGrid client
│   │   │   └── templates/             # React Email templates
│   │   ├── totp.ts                    # TOTP code generation (otplib)
│   │   ├── encryption.ts              # AES-256-GCM PHI encryption
│   │   ├── audit.ts                   # AuditLog write helper
│   │   └── blob-naming.ts             # File naming convention helpers
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives
│   │   ├── providers/                 # Provider-specific components
│   │   ├── dashboard/                 # Dashboard widgets
│   │   ├── committee/                 # Committee components
│   │   └── checklist/                 # Checklist components
│   └── types/
│       └── index.ts                   # Shared TypeScript types
├── prisma/
│   ├── schema.prisma                  # Database schema
│   └── migrations/                    # Auto-generated migrations
├── docker/
│   ├── Dockerfile.web                 # Web container
│   └── Dockerfile.worker              # Worker container
├── infra/
│   └── bicep/                         # Azure infrastructure as code (Bicep)
│       ├── main.bicep
│       ├── container-apps.bicep
│       ├── database.bicep
│       ├── redis.bicep
│       ├── blob.bicep
│       └── keyvault.bicep
├── .env.example                       # Environment variable template (no secrets)
├── package.json
└── tsconfig.json
```

---

## Database Schema (Prisma)

The Prisma schema translates directly from the data model in [data-model.md](data-model.md). Key schema patterns:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// PHI fields marked with @db.Text and encrypted at application layer
// before being written to the database. The @encrypted custom scalar
// is documented convention only — Prisma stores as plain Text;
// encryption/decryption happens in lib/encryption.ts.

model Provider {
  id                    String    @id @default(uuid())
  status                ProviderStatus @default(INVITED)
  providerTypeId        String
  assignedSpecialistId  String?
  legalFirstName        String
  legalLastName         String
  preferredName         String?
  dateOfBirth           String?   // AES-256-GCM encrypted
  ssn                   String?   // AES-256-GCM encrypted
  npi                   String?   @unique
  deaNumber             String?
  caqhId                String?
  icimsId               String?
  inviteSentAt          DateTime?
  inviteTokenHash       String?
  inviteTokenExpiresAt  DateTime?
  applicationStartedAt  DateTime?
  applicationSubmittedAt DateTime?
  committeeReadyAt      DateTime?
  approvedAt            DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  createdBy             String?

  // Relations
  providerType          ProviderType    @relation(fields: [providerTypeId], references: [id])
  assignedSpecialist    User?           @relation(fields: [assignedSpecialistId], references: [id])
  profile               ProviderProfile?
  licenses              License[]
  documents             Document[]
  checklistItems        ChecklistItem[]
  botRuns               BotRun[]
  verificationRecords   VerificationRecord[]
  tasks                 Task[]
  communications        Communication[]
  enrollments           Enrollment[]
  expirables            Expirable[]
  sanctionsChecks       SanctionsCheck[]
  npdbRecords           NPDBRecord[]
  hospitalPrivileges    HospitalPrivilege[]
  medicaidEnrollments   MedicaidEnrollment[]
  committeeProviders    CommitteeProvider[]
  auditLogs             AuditLog[]

  @@index([status])
  @@index([npi])
}

enum ProviderStatus {
  INVITED
  ONBOARDING_IN_PROGRESS
  DOCUMENTS_PENDING
  VERIFICATION_IN_PROGRESS
  COMMITTEE_READY
  COMMITTEE_IN_REVIEW
  APPROVED
  DENIED
  DEFERRED
  INACTIVE
}
```

Full schema file will be generated from the complete data model before implementation begins.

---

## Production Server

The platform is hosted on the shared HDPulse production VPS. **This is the actual current production environment** — distinct from the long-term Azure cloud target documented in the IaC section below.

| Property | Value |
|----------|-------|
| Server IP | 69.62.70.191 |
| User | hdpulse2000 |
| Server path | `/var/www/E_Credentialing` |
| Git branch | `master` |
| Compose file | `docker-compose.prod.yml` |
| Web container | `ecred-web-prod` (port 6015) |
| Worker container | `ecred-worker-prod` (port 6025) |
| Production URL | `credentialing.hdpulseai.com` |

### Production Infrastructure (shared on server)

| Service | Container / Host | Network |
|---------|-----------------|---------|
| PostgreSQL | `supabase_db_hdpulse2000:5432` | `supabase_network_hdpulse2000` |
| Redis | `host.docker.internal:6379` | host-level |

- Production DB name: `e_credentialing_db`
- Production DB user: `postgres`
- The `supabase_network_hdpulse2000` Docker network is external and shared across all production apps on the server.

### Deployment Process

Deployment is performed via a Python paramiko script (`.claude/deploy.py`) — **native SSH does not work from the dev machine**.

```bash
# Push code and deploy (standard workflow)
git push origin master
python .claude/deploy.py

# Run an arbitrary command on the production server
python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml ps"

# Run DB migration on production
python .claude/deploy.py "cd /var/www/E_Credentialing && docker exec ecred-web-prod npx prisma migrate deploy"
```

The deploy script performs these steps automatically:
1. `git pull origin master` — pulls latest code on the server
2. `docker compose -f docker-compose.prod.yml down` — stops current containers
3. `docker compose -f docker-compose.prod.yml up -d --build` — rebuilds and starts
4. `docker image prune -f` — removes dangling images
5. `docker compose -f docker-compose.prod.yml ps` — confirms container status

---

## Infrastructure as Code (Future / Azure Target)

The long-term production target is Azure Container Apps. All Azure resources will be provisioned using **Bicep** (Azure's native IaC language).

### Resource Groups

```
essen-credentialing-dev    — Development environment
essen-credentialing-staging — Staging environment (mirrors prod)
essen-credentialing-prod   — Production environment
```

### Key Resources (per environment)

| Resource | Azure Service | SKU |
|----------|--------------|-----|
| Web app | Container Apps | Consumption tier |
| Worker | Container Apps | Consumption tier |
| Database | PostgreSQL Flexible Server | Standard_D2ds_v4 (dev: Burstable B1ms) |
| Redis | Azure Cache for Redis | C1 Standard (dev: C0 Basic) |
| Blob Storage | Storage Account | Standard LRS (dev) / GRS (prod) |
| Key Vault | Key Vault | Standard |
| Container Registry | Container Registry | Basic |
| OCR | AI Document Intelligence | S0 |
| SMS | Communication Services | Pay-as-you-go |
| Monitoring | Application Insights | Workspace-based |

### Environment Variables

No secrets are stored in environment variables. All secrets are retrieved from Azure Key Vault at runtime. Only non-secret configuration is in `.env`:

```bash
# .env.example (commit this — no secrets)

# App
NEXT_PUBLIC_APP_URL=https://credentialing.hdpulseai.com
NODE_ENV=production

# Azure AD
AZURE_AD_TENANT_ID=         # Essen's Azure AD tenant ID
AZURE_AD_CLIENT_ID=         # App registration client ID
# AZURE_AD_CLIENT_SECRET -> retrieved from Key Vault at runtime

# Database
DATABASE_URL=               # PostgreSQL connection string (non-secret host/db info)
# DB password -> retrieved from Key Vault

# Redis
REDIS_HOST=                 # Redis hostname
REDIS_PORT=6380
# REDIS_PASSWORD -> retrieved from Key Vault

# Azure Resources
AZURE_KEY_VAULT_URL=        # https://{vault-name}.vault.azure.net/
AZURE_BLOB_ACCOUNT_URL=     # https://{account}.blob.core.windows.net/
AZURE_BLOB_CONTAINER=       # essen-credentialing

# Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=

# Email
SENDGRID_FROM_EMAIL=cred_onboarding@essenmed.com

# SMS
AZURE_COMMUNICATION_SERVICES_ENDPOINT=
```

---

## Authentication Architecture

### Staff (Azure AD SSO)

```
Staff Browser
    │
    ├── GET /login
    │       │
    │       ▼
    │   Auth.js → Redirect to Azure AD login
    │
    ├── User authenticates with Essen credentials (+ MFA per Azure AD policy)
    │
    ├── Azure AD → Auth.js callback with id_token + access_token
    │
    ├── Auth.js validates token, creates session (JWT or database session)
    │
    └── User.azure_ad_oid matched to User record → role loaded → session active
```

**Auth.js configuration** (`src/server/auth.ts`):
```typescript
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const authOptions = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: getSecretFromKeyVault("azure-ad-client-secret"),
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Load role from platform User table using azure_ad_oid
      const user = await db.user.findUnique({
        where: { azureAdOid: token.sub }
      })
      session.user.role = user?.role
      session.user.id = user?.id
      return session
    }
  }
}
```

### Providers (External Auth — TBD)

Until provider auth method is confirmed (Q2 in open-questions.md), provider sessions will be handled via:
- Short-lived signed JWT embedded in the outreach email link
- JWT validates provider identity for the duration of their session
- This is the Magic Link pattern — no password required
- Can be replaced with Azure AD B2B or email/password auth without changing the application structure

---

## Bot Infrastructure

### Job Queue Architecture (BullMQ)

```
Platform (Web Container)
    │
    │  provider.verifyCredentials(providerId)
    ▼
BullMQ Queues (Redis)
    ├── psv-bots          (license, DEA, boards, sanctions, NPDB)
    │     priority: high
    ├── enrollment-bots   (portal submissions, FTP uploads)
    │     priority: medium
    └── scheduled-jobs    (nightly expirables, monthly sanctions)
          priority: low
              │
              ▼
Worker Container (BullMQ Worker processes)
    ├── PSV Bot Worker (concurrency: 5)
    │     Playwright instance per job
    ├── Enrollment Bot Worker (concurrency: 3)
    │     Playwright instance per job
    └── Scheduler Worker (concurrency: 2)
          No Playwright — API/database jobs
```

**Queue configuration**:
```typescript
// src/workers/queues.ts
import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

export const psvBotQueue = new Queue("psv-bots", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 }, // 1min, 2min, 4min
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
})

export const enrollmentBotQueue = new Queue("enrollment-bots", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 120_000 },
  },
})

export const scheduledJobQueue = new Queue("scheduled-jobs", {
  connection: redis,
})
```

**Scheduled jobs** (cron-triggered via BullMQ):
```typescript
// Nightly expirables scan — 2:00 AM UTC
await scheduledJobQueue.add("expirables-scan", {}, {
  repeat: { cron: "0 2 * * *" }
})

// Monthly sanctions recheck — 1st of month, 3:00 AM UTC
await scheduledJobQueue.add("sanctions-monthly", {}, {
  repeat: { cron: "0 3 1 * *" }
})

// Follow-up cadence check — every hour
await scheduledJobQueue.add("follow-up-cadence", {}, {
  repeat: { cron: "0 * * * *" }
})
```

### Bot Concurrency & Rate Limiting

PSV bots interact with external websites. Rate limits must be respected:

| Bot | Concurrency | Rate Limit | Delay Between Runs |
|-----|------------|------------|-------------------|
| License (healthguideusa.org) | 2 | ~30 req/min | 2s between requests |
| NCCPA | 1 | Conservative | 5s between requests |
| ABIM | 2 | Conservative | 3s between requests |
| ABFM | 1 | Conservative | 5s between requests |
| OIG (API/DB) | 5 | No limit (local DB) | None |
| SAM.gov API | 3 | 10 req/sec | 100ms |
| NPDB | 1 | Per NPDB agreement | As required |
| DEA | 1 | MFA session limited | Session reuse |
| Enrollment portals | 1 per portal | Portal session limited | Session reuse |

---

## OCR / Document Intelligence

**Service**: Azure AI Document Intelligence (formerly Azure Form Recognizer)

**Model**: Prebuilt + Custom models
- **Prebuilt ID model** (`prebuilt-idDocument`) — for driver's license and passport
- **Prebuilt Invoice model** — not used
- **Custom model** — trained on Essen credential document types (licenses, DEA certificates, board certs, etc.) — trained after initial dataset is collected

**Integration point** (`src/lib/azure/document-intelligence.ts`):
```typescript
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer"

export async function analyzeDocument(blobUrl: string, documentType: string) {
  const client = new DocumentAnalysisClient(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!,
    new DefaultAzureCredential()
  )

  const modelId = getModelForDocumentType(documentType)
  const poller = await client.beginAnalyzeDocumentFromUrl(modelId, blobUrl)
  const result = await poller.pollUntilDone()

  return extractFields(result, documentType)
}
```

**OCR confidence threshold**: Fields with confidence < 0.85 are left empty and flagged for manual review.

---

## Encryption Implementation

PHI fields (SSN, DOB, home address) are encrypted before writing to the database and decrypted after reading.

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "base64") // 32 bytes, from Key Vault

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv:authTag:ciphertext (base64)
  return [iv, authTag, encrypted].map(b => b.toString("base64")).join(":")
}

export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":")
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const encrypted = Buffer.from(encryptedB64, "base64")
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}
```

The encryption key itself is stored in Azure Key Vault and retrieved at startup via Managed Identity.

---

## CI/CD Pipeline

**Platform**: GitHub Actions (or Azure DevOps Pipelines)

### Pipeline stages

```
Push to feature branch
    │
    ├── 1. Lint (ESLint + TypeScript check)
    ├── 2. Unit tests (Jest / Vitest)
    ├── 3. Build Docker images (web + worker)
    └── 4. Deploy to dev environment (Container Apps)

Merge to main
    │
    ├── All above steps
    ├── 5. Integration tests (against staging DB)
    ├── 6. Deploy to staging environment
    └── 7. Manual approval gate → Deploy to production
```

### Docker Containers

**Web container** (`docker/Dockerfile.web`):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Worker container** (`docker/Dockerfile.worker`):
```dockerfile
FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium
COPY . .
RUN npm run build:worker
CMD ["node", "dist/workers/index.js"]
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Next.js over separate React + Node.js

**Status**: Accepted
**Decision**: Use Next.js (full-stack) rather than separate React frontend + Express backend.
**Rationale**: Single repository, single language, reduced operational complexity. Next.js API routes and tRPC handle all backend needs. The worker process runs separately regardless of this decision.
**Trade-offs**: Next.js API routes have cold-start considerations in serverless mode — mitigated by using Container Apps (always-on containers, not serverless functions).

---

### ADR-002: tRPC over REST

**Status**: Accepted
**Decision**: Use tRPC for client-server API communication instead of a traditional REST API.
**Rationale**: End-to-end type safety between Next.js frontend and backend eliminates a class of runtime bugs. The API is consumed only by our own frontend — no need for a public REST spec.
**Trade-offs**: Less familiar than REST for new developers. Not suitable if a public API is ever needed (would add a separate REST/OpenAPI layer at that point).

---

### ADR-003: BullMQ over Azure Service Bus for bot queue

**Status**: Accepted
**Decision**: Use BullMQ (Redis-backed) for the bot job queue instead of Azure Service Bus.
**Rationale**: BullMQ provides a rich Node.js-native API with built-in retries, rate limiting, priority queues, scheduled jobs, and a dashboard (Bull Board). Azure Service Bus is more appropriate for cross-service communication. For an in-process worker queue, BullMQ is simpler and more feature-rich.
**Trade-offs**: Adds Redis as a dependency. Mitigated by using Azure Cache for Redis (managed service). If the platform grows to need cross-service event streaming, Azure Service Bus can be added alongside BullMQ.

---

### ADR-004: Azure Blob Storage replaces K: drive

**Status**: Accepted
**Decision**: All documents and bot output files are stored in Azure Blob Storage. The K: drive PCD folder system is deprecated.
**Rationale**: K: drive requires VPN/network connectivity for programmatic access. Azure Blob is natively accessible from containers, supports RBAC, generates SAS tokens for secure user downloads, and has no network drive mapping requirement.
**Migration**: During transition, a dual-write adapter writes files to both Azure Blob and the K: drive (via SMB mount). After validation, K: drive writes are disabled.

---

### ADR-005: AES-256-GCM encryption at application layer for PHI

**Status**: Accepted
**Decision**: Encrypt SSN, DOB, and home address at the application layer (before writing to Postgres) rather than relying solely on database-level encryption.
**Rationale**: Defense in depth. Even if the database is compromised directly (e.g., a leaked connection string), PHI fields are still encrypted. Azure Database for PostgreSQL also encrypts at rest — this provides a second layer.
**Trade-offs**: Cannot query or filter on encrypted fields. Mitigated by design: the system never needs to search by SSN or DOB (all lookups are by provider ID or name).

---

### ADR-006: Magic Link as interim provider auth

**Status**: Accepted (interim)
**Decision**: Use signed JWT embedded in the outreach email link as interim provider authentication. No password required.
**Rationale**: Simplest implementation; providers only use the application a handful of times. Avoids password reset infrastructure. Can be replaced with Azure AD B2B or email/password auth transparently once Q2 is resolved.
**Trade-offs**: Link expires (72 hours). If provider loses the link, they need staff to resend it. Acceptable for an infrequent-use portal.

---

## Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| **Web container** | **6015** | Next.js App Router — UI + tRPC API + Auth.js + Socket.io |
| **Worker container** | **6025** | BullMQ workers + Playwright bots + Bull Board dashboard |

These ports are used in both development (docker-compose.dev.yml) and production (docker-compose.prod.yml).

---

## Docker Files

The repository includes four Dockerfiles following the patterns of sibling applications:

| File | Purpose |
|------|---------|
| `Dockerfile.web` | Web container — development (hot reload via volume mounts) |
| `Dockerfile.web.prod` | Web container — production (multi-stage build, non-root user) |
| `Dockerfile.worker` | Worker container — development (Playwright jammy base, hot reload) |
| `Dockerfile.worker.prod` | Worker container — production (Playwright jammy base, optimized) |

**Note**: The worker container uses `mcr.microsoft.com/playwright:v1.50.0-jammy` (Ubuntu 22.04) as its base image — not `node:20-alpine` — because Playwright requires OS-level browser dependencies that are not available in Alpine.

---

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Development — connects to shared `localai_default` network |
| `docker-compose.prod.yml` | Production — connects to `supabase_network_hdpulse2000` |

---

## Local Infrastructure (Shared Docker Containers)

This machine runs shared infrastructure containers used by all applications on the `localai_default` Docker network. **Do not create new PostgreSQL or Redis containers** — connect to the existing shared ones.

### Shared Containers

| Container | Image | Network | Host Port | Internal Access |
|-----------|-------|---------|-----------|----------------|
| `localai-postgres-1` | `postgres:latest` | `localai_default` | 5433 | `localai-postgres-1:5432` |
| `redis` | `valkey/valkey:8-alpine` | `localai_default` | 6379 | `redis:6379` |

### Database

- **Host**: `localai-postgres-1` (from within `localai_default` network) or `localhost:5433` (from host)
- **User**: `postgres`
- **Password**: `testpostgrespass00`
- **Database name**: `e_credentialing_db` (must be created before first run — see setup below)

### Redis

- **Host**: `redis` (from within `localai_default` network) or `localhost:6379` (from host)
- **Port**: 6379
- **Auth**: none required (local dev)

---

## Development Environment Setup

### Prerequisites — Confirmed Installed (as of 2026-04-14)

| Tool | Required Version | Installed Version | Status |
|------|-----------------|-------------------|--------|
| Node.js | 20+ | v22.17.0 | ✅ |
| npm | 10+ | 11.5.2 | ✅ |
| Docker Desktop | Latest | 29.1.5 | ✅ |
| Docker Compose | v2+ | v5.0.1 | ✅ |
| Git | Latest | 2.50.0 | ✅ |
| Playwright | (installed via npm) | v1.59.1 (via npx) | ✅ |
| Python 3 | Required for deploy script | 3.13.5 | ✅ at `C:\Users\admin\AppData\Local\Programs\Python\Python313\` |
| paramiko | Required for deploy script | Installed | ✅ |
| Azure CLI | Required for Key Vault local access | **Not installed** | ⚠️ |

**Azure CLI**: Install from https://aka.ms/installazurecliwindows. Run `az login` to authenticate with Essen's Azure tenant before running bots locally.

**Python in bash shell**: The `python3` alias is not mapped in Git Bash. Use the full path or invoke via `python .claude/deploy.py` (Windows `python` command works). Paramiko is confirmed installed.

### Local Setup (Docker — Recommended)

```bash
# 1. Copy environment template
cp .env.example .env.local
# Fill in Azure AD, Key Vault, Blob Storage, and SendGrid values

# 2. Create the database (one-time setup)
docker exec localai-postgres-1 psql -U postgres -c "CREATE DATABASE e_credentialing_db;"

# 3. Start both containers (web on :6015, worker on :6025)
docker compose -f docker-compose.dev.yml up --build

# 4. In a separate terminal — run Prisma migrations
docker exec ecred-web npx prisma migrate dev

# 5. Seed initial data (provider types, admin user)
docker exec ecred-web npm run db:seed
```

Once running:
- **Web app**: http://localhost:6015
- **Bull Board** (job queue monitor): http://localhost:6025

### Local Setup (Without Docker — Alternative)

```bash
# Prerequisites: Node.js 22, Redis on localhost:6379, Postgres on localhost:5433

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment template and set REDIS_HOST=localhost, DB port=5433
cp .env.example .env.local

# Create database
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE e_credentialing_db;"

# Run database migrations
npx prisma migrate dev

# Seed initial data
npm run db:seed

# Start web app (dev mode) — runs on port 6015
npm run dev

# Start worker in a separate terminal — Bull Board on port 6025
npm run dev:worker
```

### Local Bot Testing

```bash
# Run a specific bot in headed mode (visible browser) against a specific provider
npm run bot:headed -- --type=license --providerId={uuid}

# Run all bots for a provider (queued)
npm run bot:run -- --providerId={uuid}
```

### Stopping the Environment

```bash
docker compose -f docker-compose.dev.yml down
```

---

## Security Checklist

Before production deployment, verify:

- [ ] Azure AD app registration scopes are minimal (`openid`, `profile`, `email` only)
- [ ] All Key Vault secrets have access policies restricted to the app's Managed Identity only
- [ ] Azure Blob Storage containers have no public access enabled
- [ ] PostgreSQL firewall allows only Container Apps subnets (no public internet access)
- [ ] Redis is not publicly accessible (private endpoint or VNet integration)
- [ ] All HTTPS connections enforced (TLS 1.2+ minimum)
- [ ] PHI encryption key is stored in Key Vault and rotated annually
- [ ] Bot logs are audited to confirm SSN and credentials are never logged
- [ ] NPDB data use agreement terms are reviewed and role-based access is enforced
- [ ] HIPAA BAA signed with all relevant Azure services (Azure has a BAA for covered services)
- [ ] SendGrid HIPAA BAA reviewed (if PHI appears in emails — should be avoided)
- [ ] Audit log table has no DELETE or UPDATE grants on the application DB role
- [ ] Container images are scanned for vulnerabilities in CI pipeline
