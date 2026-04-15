# ESSEN Credentialing Platform — Technical Documentation

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Status**: Active — Updated as architecture evolves  
**Audience**: Developers, DevOps  

---

## 1. Architecture Overview

The platform uses a two-container architecture:

```
Browser
  │
  ├─ HTTP/WebSocket ──► [ecred-web] Next.js App (port 6015)
  │                         ├─ App Router (RSC + Client Components)
  │                         ├─ tRPC API (/api/trpc)
  │                         ├─ Auth.js v5 (/api/auth)
  │                         └─ Prisma ORM ──► PostgreSQL
  │
  └─ WebSocket ──────► [ecred-worker] BullMQ Worker (port 6025)
                            ├─ Bull Board UI (/bull-board)
                            ├─ Playwright PSV bots
                            └─ Redis pub/sub ──► Socket.io ──► Browser
```

Both containers connect to shared infrastructure (`localai_default` Docker network):
- **PostgreSQL**: `localai-postgres-1:5432` (port 5433 on host), database `e_credentialing_db`
- **Redis**: `redis:6379` (port 6379 on host)

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14+ | App Router, TypeScript |
| API | tRPC | v11 | Type-safe client/server, batch requests |
| ORM | Prisma | 5.x | PostgreSQL driver |
| Auth | Auth.js (NextAuth) | v5 | Microsoft Entra ID provider |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI components | shadcn/ui | Latest | Radix UI primitives (used selectively) |
| Bot automation | Playwright | 1.x | Headless Chromium, runs in worker container |
| Job queue | BullMQ | 4.x | Redis-backed, priority queues |
| Real-time | Socket.io | 4.x | Worker → Browser status updates |
| File storage | Azure Blob Storage | @azure/storage-blob | Replaces K: drive |
| Secrets | Azure Key Vault | @azure/keyvault-secrets | DEA TOTP, API keys |
| PHI encryption | Node.js crypto | Built-in | AES-256-GCM |
| Email | SendGrid + React Email | - | Outreach, reminders |
| SMS | Azure Communication Services | - | Provider outreach |
| OCR | Azure AI Document Intelligence | - | Photo ID data extraction |

---

## 3. Project Directory Structure

```
src/
├── app/
│   ├── (staff)/                  # Staff portal (requires Azure AD session)
│   │   ├── dashboard/            # KPI dashboard
│   │   ├── providers/
│   │   │   ├── page.tsx          # Provider list (server component)
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Provider detail (server component, 8 tabs)
│   │   │       └── bots/page.tsx # Bot control panel
│   │   ├── enrollments/
│   │   │   ├── page.tsx          # Enrollment list
│   │   │   └── [id]/page.tsx     # Enrollment detail
│   │   ├── committee/
│   │   │   ├── page.tsx          # Committee queue
│   │   │   └── sessions/
│   │   │       ├── page.tsx      # All sessions
│   │   │       ├── new/page.tsx  # Create session
│   │   │       └── [id]/page.tsx # Session detail
│   │   ├── expirables/page.tsx   # Expirables monitoring
│   │   └── admin/
│   │       └── users/page.tsx    # Staff user management
│   ├── (provider)/               # Provider application portal
│   │   └── application/
│   ├── api/
│   │   ├── auth/[...nextauth]    # Auth.js handlers
│   │   └── trpc/[trpc]           # tRPC HTTP handler
│   ├── layout.tsx                # Root layout (providers, sidebar, auth)
│   └── page.tsx                  # Public landing page
├── components/
│   ├── admin/
│   │   └── AdminUserActions.tsx  # Edit/deactivate/invite user modals
│   ├── bots/
│   │   └── BotStatusPanel.tsx    # Real-time bot status with Socket.io
│   ├── checklist/
│   │   └── ChecklistPanel.tsx    # Document checklist
│   ├── enrollments/
│   │   └── EnrollmentActions.tsx # Update status / log follow-up modals
│   ├── providers/
│   │   ├── AddProviderModal.tsx  # New provider creation modal
│   │   ├── ProviderHeaderActions.tsx # Edit info + status transitions
│   │   └── ProviderStatusBadge.tsx   # Status color badge
│   ├── tasks/
│   │   └── TaskManager.tsx       # Task list + add task modal
│   └── ui/                       # shadcn/ui primitives
├── server/
│   ├── api/
│   │   ├── root.ts               # Root tRPC router
│   │   ├── trpc.ts               # Context, middleware, procedure builders
│   │   └── routers/
│   │       ├── admin.ts          # User management, provider types, stats
│   │       ├── bot.ts            # Bot triggering, status
│   │       ├── committee.ts      # Sessions, voting
│   │       ├── communication.ts  # Communication logging
│   │       ├── document.ts       # Document upload/checklist
│   │       ├── enrollment.ts     # Enrollment CRUD, follow-ups
│   │       ├── expirable.ts      # Expirable tracking
│   │       ├── npdb.ts           # NPDB queries
│   │       ├── provider.ts       # Provider CRUD, status transitions
│   │       ├── sanctions.ts      # OIG/SAM checks
│   │       └── task.ts           # Task CRUD
│   ├── auth.ts                   # Auth.js config (Azure AD provider)
│   └── db.ts                     # Prisma client singleton
├── trpc/
│   ├── react.tsx                 # Client-side tRPC provider + hooks
│   └── server.ts                 # Server-side tRPC caller
├── lib/
│   ├── audit.ts                  # writeAuditLog() utility
│   ├── encryption.ts             # AES-256-GCM encrypt/decrypt
│   └── azure/                    # Blob storage, Key Vault clients
├── middleware.ts                 # Route protection (Auth.js middleware)
└── types/                        # Shared TypeScript types
```

---

## 4. Authentication & Authorization

### Staff Authentication (Azure AD SSO)

Auth.js v5 is configured with Microsoft Entra ID provider. The flow:

1. User visits any protected route → middleware redirects to `/auth/signin`
2. `/auth/signin` shows "Sign in with Microsoft" button
3. Azure AD handles authentication → callback to `/api/auth/callback/microsoft-entra-id`
4. Auth.js creates a session; user record is matched by email or created in the database
5. Session token stored as HTTP-only cookie; expires after 8 hours of inactivity

### Middleware Route Protection (`src/middleware.ts`)

Public routes (no auth required):
- `/` (landing page)
- `/auth/*` (sign-in, sign-out, callbacks)
- `/api/auth/*` (Auth.js handlers)
- `/api/webhooks/*` (external webhooks)
- `/api/health` (health check)
- `/application*` (provider portal — token-validated at page level)

All other routes require a valid session. Admin-only routes additionally check `role === "ADMIN" || role === "MANAGER"`.

### tRPC Procedure Authorization

Three procedure levels enforced server-side:
- `staffProcedure` — requires any authenticated session (SPECIALIST, MANAGER, ADMIN, COMMITTEE_MEMBER)
- `managerProcedure` — requires MANAGER or ADMIN role
- `adminProcedure` — requires ADMIN role only

---

## 5. Data Model Summary

See `docs/planning/data-model.md` for the full entity definitions. Key entities:

| Entity | Table | Description |
|--------|-------|-------------|
| Provider | `Provider` | Core credentialing record |
| ProviderProfile | `ProviderProfile` | Extended demographics (PHI encrypted) |
| License | `License` | State medical/professional licenses |
| ChecklistItem | `ChecklistItem` | Per-provider document checklist |
| Document | `Document` | Uploaded files (Azure Blob references) |
| VerificationRecord | `VerificationRecord` | PSV bot results |
| Task | `Task` | Staff tasks assigned to providers |
| Communication | `Communication` | Email/call/SMS log |
| Enrollment | `Enrollment` | Payer enrollment records |
| EnrollmentFollowUp | `EnrollmentFollowUp` | Follow-up activity log |
| Expirable | `Expirable` | Credentials with expiration dates |
| BotRun | `BotRun` | Bot execution records |
| SanctionsCheck | `SanctionsCheck` | OIG/SAM query results |
| NpdbRecord | `NpdbRecord` | NPDB query results |
| CommitteeSession | `CommitteeSession` | Scheduled committee meetings |
| CommitteeAgendaItem | `CommitteeAgendaItem` | Per-provider agenda + vote |
| AuditLog | `AuditLog` | Immutable activity log |
| User | `User` | Staff users |
| ProviderType | `ProviderType` | MD, DO, PA, NP, etc. |

---

## 6. API Layer (tRPC)

### Client Usage (client components)
```typescript
import { api } from "@/trpc/react";

// Query
const { data } = api.provider.getById.useQuery({ id });

// Mutation with side effects
const mutation = api.enrollment.updateStatus.useMutation({
  onSuccess: () => {
    setOpen(false);
    router.refresh(); // re-fetches server components
  },
});
mutation.mutate({ id, status: "ENROLLED", payerConfirmationNumber: "12345" });
```

### Server Usage (server components)
```typescript
import { api } from "@/trpc/server";

const enrollment = await api.enrollment.getById({ id });
```

### Key Procedures

**provider router**:
- `provider.list` — paginated, filterable list
- `provider.getById` — full provider with all relations
- `provider.create` — creates new provider record
- `provider.update` — updates editable fields (NPI, DEA, CAQH, notes, specialist)
- `provider.transitionStatus` — enforces state machine transitions, writes audit log

**enrollment router**:
- `enrollment.list` — all enrollments, filterable
- `enrollment.getById` — full enrollment with follow-ups
- `enrollment.create` — new enrollment record
- `enrollment.updateStatus` — updates status + optional fields
- `enrollment.addFollowUp` — logs follow-up activity

**task router**:
- `task.create` — creates task assigned to staff member
- `task.update` — update status, priority, due date

**admin router**:
- `admin.listUsers` — all staff users
- `admin.createUser` — pre-create user record (matched on first SSO login)
- `admin.updateUser` — change name, role, active status
- `admin.deactivateUser` — soft-disable (cannot deactivate self)

---

## 7. State Management Pattern

The app uses Next.js App Router's server/client component split:

- **Server components** fetch data directly from the database via Prisma or tRPC server caller
- **Client components** handle interactivity (modals, forms, real-time updates)
- After a client-side mutation, `router.refresh()` is called to re-fetch server component data without a full page reload
- No global client-side state store (Redux, Zustand) — server components are the source of truth

---

## 8. Bot Architecture (Worker)

The worker container runs independently on port 6025:

1. **BullMQ queue** receives bot job requests (created by `bot.triggerBot` tRPC mutation)
2. **Playwright** launches headless Chromium and navigates the target website
3. Results (status, PDF path, notes) are saved to `BotRun` and `VerificationRecord` in the database
4. Worker publishes status updates to Redis pub/sub channel `bot:status:{providerId}`
5. **Socket.io** server (on worker) broadcasts updates to subscribed browser clients
6. `BotStatusPanel` client component listens via `io(NEXT_PUBLIC_WORKER_URL)` and updates the UI

---

## 9. Environment Variables

### Web Container (`.env` / `.env.local`)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localai-postgres-1:5432/e_credentialing_db

# Auth
NEXTAUTH_SECRET=<32-byte random base64>
NEXTAUTH_URL=http://localhost:6015
AZURE_AD_TENANT_ID=<tenant-id>
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_CLIENT_SECRET=<client-secret>

# Redis
REDIS_URL=redis://redis:6379

# Azure
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_KEY_VAULT_URL=https://<vault>.vault.azure.net/

# PHI Encryption
ENCRYPTION_KEY=<32-byte base64>

# Worker URL (browser-accessible, for Socket.io)
NEXT_PUBLIC_WORKER_URL=http://localhost:6025
```

### Worker Container

```env
DATABASE_URL=postgresql://postgres:postgres@localai-postgres-1:5432/e_credentialing_db
REDIS_URL=redis://redis:6379
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_KEY_VAULT_URL=https://<vault>.vault.azure.net/
ENCRYPTION_KEY=<32-byte base64>
WORKER_PORT=6025
```

---

## 10. Local Development

### Start the full stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Web app: http://localhost:6015
- Bull Board (job monitor): http://localhost:6025/bull-board

### Database commands

```bash
# Create database (one-time)
docker exec localai-postgres-1 psql -U postgres -c "CREATE DATABASE e_credentialing_db;"

# Run migrations
docker exec ecred-web npx prisma migrate dev

# Seed initial data (provider types, admin user)
docker exec ecred-web npm run db:seed

# Open Prisma Studio
docker exec ecred-web npx prisma studio
```

### TypeScript check

```bash
docker exec ecred-web sh -c "cd /app && npx tsc --noEmit"
```

---

## 11. Production Deployment

Production runs on server `69.62.70.191` at `/var/www/E_Credentialing`.

### Deploy command (from local machine)

```bash
# Stage, commit, push, and deploy in one step:
# (Claude Code will do this automatically on "push and deploy")

git add <files>
git commit -m "description"
git push origin master
python .claude/deploy.py
```

**Important**: Native SSH does not work from the dev machine. Always use `python .claude/deploy.py` (paramiko-based).

### Production infrastructure

| Service | Connection | Notes |
|---------|-----------|-------|
| PostgreSQL | `supabase_db_hdpulse2000:5432` | Shared prod DB container |
| Redis | `host.docker.internal:6379` | Shared Redis on prod server |
| Web | `ecred-web-prod` container | Port 6015, reverse-proxied by Nginx |
| Worker | `ecred-worker-prod` container | Port 6025 |

### Post-deploy steps (first time only)

```bash
# Create database
python .claude/deploy.py "docker exec supabase_db_hdpulse2000 psql -U postgres -c 'CREATE DATABASE e_credentialing_db;'"

# Run migrations
python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate deploy"

# Seed data
python .claude/deploy.py "docker exec ecred-web-prod npm run db:seed"
```

---

## 12. Security Considerations

- **PHI encryption**: `ProviderProfile` fields (SSN, DOB) are AES-256-GCM encrypted before storage
- **Audit logging**: all mutations call `writeAuditLog()` — never skip this in new procedures
- **Input validation**: all tRPC inputs use Zod schemas — never trust raw input
- **File uploads**: documents go directly to Azure Blob Storage via SAS tokens — never store files on disk
- **TOTP secret**: DEA MFA secret stored in Azure Key Vault, never in the database or environment variables
- **Session security**: HTTP-only cookies, SameSite=Lax, 8-hour idle timeout

---

## 13. Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-14 | 0.1 | Initial architecture doc from planning |
| 2026-04-15 | 1.0 | Updated with implemented structure, API patterns, component list |
