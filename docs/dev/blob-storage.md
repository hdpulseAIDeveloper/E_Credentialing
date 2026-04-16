# Blob Storage and SAS Downloads

Azure Blob Storage is the single source of truth for files (uploaded documents, bot-output PDFs, committee packets, roster archives).

## Container layout

One container per environment: `ecred-files-dev`, `ecred-files-staging`, `ecred-files-prod`.

```
/providers/{provider-id}/
    /documents/{documentId}-{safeFilename}
    /verifications/{botRunId}-{label}.pdf
    /summaries/{providerId}-{yyyymmdd}.pdf
/committee/{meetingId}/agenda.pdf
/rosters/{yyyymm}/{payerId}.csv
```

Privacy level: **Private** (no public access). See `docs/status/blocked.md` `B-002` if this needs to be confirmed/enforced.

## Upload flow

1. Client POSTs multipart to `/api/upload` with provider token or staff session.
2. Handler authorizes, generates `documentId`, writes the blob via `@azure/storage-blob`'s block blob uploader with server-side encryption enabled.
3. Handler inserts `Document` row with `blobPath` (never `blobUrl`), `uploaderType`, `uploadedById` (nullable), and the original filename.
4. Returns `{ id, createdAt, filename, mimeType, size }`.

## Download flow

All downloads go through the authenticated endpoint `/api/documents/[id]/download`:

1. Authenticate caller (staff session or provider token, with IDOR check: the provider token's providerId must match the document's provider).
2. Write `AuditLog` entry (`action = "DOCUMENT_DOWNLOAD"`).
3. Request a **user-delegation SAS** from Azure for the specific blob, TTL = 5 minutes, permissions = read only.
4. Respond with HTTP 302 → the SAS URL.

Client (browser or API) follows the redirect directly to Azure. The SAS URL is not stored or logged with full query string — redaction is enforced in `pino` config.

## Do not store SAS URLs

The platform used to write `blobUrl` into the `Document` row. This is no longer done; `blobPath` is stored and SAS is minted on demand. Any old code paths or migrations referencing `blobUrl` must be removed.

## Naming conventions

Filenames follow the legacy convention in Essen's credentialing files so staff recognize them:

| Artifact | Example |
|----------|---------|
| State license PSV | `NY License Verification, Exp. 06.30.2028.pdf` |
| DEA PSV | `DEA Verification, Exp. 06.30.2026.pdf` |
| Board PSV | `Boards Verification ABIM exp 12.31.2029.pdf` |
| OIG | `OIG Sanctions Check 04.01.2026.pdf` |
| SAM | `SAM Sanctions Check 04.01.2026.pdf` |

These are the display names shown in the UI. The blob storage key uses UUIDs to avoid collisions.

## Lifecycle and retention

- Documents: retained for 7 years after provider termination (NCQA standard).
- Committee summaries: retained indefinitely.
- Roster CSVs: retained indefinitely.
- Old Playwright screenshots (debug artifacts): purged at 30 days via an Azure Blob lifecycle rule.

## Anti-virus scanning

Each upload triggers an Azure Defender for Storage scan. Infected blobs are quarantined. The `Document` row is marked `virusFound=true` and the uploader is alerted. A Compliance Officer reviews before the file can be re-enabled.

## Development

For local dev, the Blob Storage account is either:

- A shared Azure dev account (default; credentials via `AZURE_STORAGE_CONNECTION_STRING`), or
- Azurite (`npm run azurite`) — uses a local emulator and a well-known connection string.

To use Azurite:

```
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```

All code paths are identical; the Azure SDK picks the provider based on the connection string.

## Code entry points

- Upload: `src/app/api/upload/route.ts`
- Download: `src/app/api/documents/[id]/download/route.ts`
- SAS minting helper: `src/lib/blob-storage/sas.ts`
- Verification PDF writer (from workers): `src/workers/lib/blob-output.ts`

## Troubleshooting

### 403 from SAS URL

Usually the SAS has expired (5-minute window). Trigger a fresh download from the UI.

### Upload returns 413

`next.config.mjs` sets body limit per route. Default is 50MB; if a legitimate file is larger, bump in that specific route and document why.

### "AuthorizationFailure" creating user-delegation SAS

The app's Entra identity lacks `Storage Blob Delegator` role on the storage account. Grant via Azure Portal or `az role assignment create`.
