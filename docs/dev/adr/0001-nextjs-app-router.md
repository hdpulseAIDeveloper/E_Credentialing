# 0001. Use Next.js 14 App Router

- Status: Accepted
- Date: 2026-02-10

## Context

We need a full-stack TypeScript framework with server components, typed API layer, good DX, and a production-ready deploy story.

## Decision

Use Next.js 14+ with the App Router. Render server components by default; opt into client components where interactivity requires.

## Consequences

- Standalone builds for Docker/ACA; no custom server.
- Built-in file-based routing and route handlers.
- Interop with tRPC via route handlers.
- Middleware for auth and rate-limit gates.
- Requires Node 22+.

## Alternatives considered

- **Remix** — capable, but smaller team knowledge and fewer Azure integrations out of the box.
- **Pages Router** — maturing framework; App Router is the forward-looking default.
- **SvelteKit** — not a realistic choice for a team already investing in React.
