# 0006. Private blob storage with short-lived SAS URLs

- Status: Accepted
- Date: 2026-04-16

## Context

Earlier code stored a direct `blobUrl` on every `Document` row and the UI rendered that URL in a link tag. This:

- Leaked long-lived URLs to clients.
- Made auditing downloads impossible.
- Potentially exposed documents if a URL ended up in logs, screenshots, or bookmarks.

## Decision

Never store `blobUrl`. Persist only `blobPath`. Serve downloads through `/api/documents/[id]/download`:

1. Authenticate (staff session or provider token with IDOR check).
2. Write an `AuditLog` entry.
3. Mint a user-delegation SAS with 5-minute TTL and read-only permission.
4. HTTP 302 to the SAS URL.

The UI hands its `<a href>` to the authenticated route; Azure handles the actual bytes.

## Consequences

- Every document download is auditable.
- No long-lived URL escapes the authenticated perimeter.
- Staff and providers both use the same route (`/api/documents/[id]/download`).
- Rotating Blob SAS permissions does not require changing DB records.
- The 5-minute TTL is generous for a human click; for large downloads the browser initiates before the URL expires.

## Alternatives considered

- **Proxy the bytes through the web container** — feasible, but doubles bandwidth and hurts latency for large files.
- **Long-lived SAS** — defeats the purpose; same as exposing the blob URL.
- **Azure Front Door with token auth** — needs more infrastructure; revisit once we migrate to ACA.
