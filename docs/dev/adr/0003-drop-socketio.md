# 0003. Drop Socket.io, use tRPC polling for real-time UI

- Status: Accepted
- Date: 2026-04-16

## Context

Bot status updates and a few other UI states need to feel "live." The initial implementation used Socket.io with a custom Next.js server (`src/server.ts`) and a client hook (`src/hooks/useSocket.ts`). Two issues surfaced:

1. The custom server prevents us from using Next.js standalone output, which is what Azure Container Apps and our current Docker setup rely on.
2. Socket.io added a sticky-session requirement that complicates horizontal scaling.

## Decision

Remove Socket.io and `src/server.ts`. Use TanStack Query's `refetchInterval` via tRPC to poll endpoints at short intervals when UI state is actively changing (e.g., bot `QUEUED`/`RUNNING`). Invalidate after mutations.

## Consequences

- Standard Next.js standalone build works out of the box.
- No sticky sessions required; scale web horizontally with a plain L4 load balancer.
- Polling generates more requests than a persistent socket, but:
  - We cap poll frequency at 5s when anything is changing, 30s on dashboards.
  - The additional load is negligible at current scale (< 100 staff).
- The `/api/socket` route is retained as a sentinel that returns `{ mode: "polling" }` to confirm the decision to any client that still tries to upgrade.
- Redis pub/sub still available for worker→web event fan-out when useful (e.g., batch job progress), but the wire to the browser is plain HTTP.

## Alternatives considered

- **Keep Socket.io with an external Node server** — added ops complexity and defeated the simplicity of Container Apps.
- **Server-Sent Events** — viable, but requires bespoke per-page endpoints; tRPC query polling integrates with the existing cache and devtools.
- **WebSockets via Next.js route handler** — not currently supported in standalone mode.
