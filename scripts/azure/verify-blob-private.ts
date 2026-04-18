/**
 * verify-blob-private.ts — Verifier half of B-002 (Azure Blob container privacy).
 *
 * READ-ONLY. Confirms that the documents container is configured for
 * Private access (no anonymous reads). SAS URLs remain the only way to
 * download a blob; if the container is ever flipped to Blob or Container
 * public access (deliberately or by mistake), this script fails and the
 * Pillar P (Compliance) job in CI turns red.
 *
 * Wired into:
 *   - .github/workflows/qa-fix-until-green.yml (Pillar P / nightly)
 *   - npm run qa:azure-privacy (added in package.json)
 *
 * Auth: DefaultAzureCredential — env vars > workload identity > az login.
 *
 * Required role on the storage account:
 *   "Storage Blob Data Reader" (read container properties; cannot read blobs).
 *
 * Exit codes:
 *   0 -> container public access is "none"
 *   1 -> container public access is "blob" or "container" (PHI exposure risk)
 *   2 -> cannot reach the storage account / container missing
 *
 * Usage:
 *   AZURE_BLOB_ACCOUNT_URL=https://<account>.blob.core.windows.net \
 *   AZURE_BLOB_CONTAINER=essen-credentialing \
 *   npx tsx scripts/azure/verify-blob-private.ts
 */
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

interface Result {
  account: string;
  container: string;
  publicAccess: string;
  verdict: "PRIVATE" | "PUBLIC" | "UNKNOWN";
  exitCode: 0 | 1 | 2;
  notes: string[];
}

async function main(): Promise<number> {
  const accountUrl = process.env.AZURE_BLOB_ACCOUNT_URL;
  const containerName = process.env.AZURE_BLOB_CONTAINER ?? "essen-credentialing";

  if (!accountUrl) {
    console.error(
      "FATAL: AZURE_BLOB_ACCOUNT_URL is not set. Cannot verify container privacy.",
    );
    return 2;
  }

  const account = new URL(accountUrl).hostname.split(".")[0] ?? accountUrl;
  const result: Result = {
    account,
    container: containerName,
    publicAccess: "unknown",
    verdict: "UNKNOWN",
    exitCode: 2,
    notes: [],
  };

  let svc: BlobServiceClient;
  try {
    svc = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  } catch (e) {
    console.error(`FATAL: cannot construct BlobServiceClient: ${(e as Error).message}`);
    return 2;
  }

  const container = svc.getContainerClient(containerName);
  let exists = false;
  try {
    exists = await container.exists();
  } catch (e) {
    result.notes.push(`exists() error: ${(e as Error).message}`);
  }
  if (!exists) {
    console.error(`FATAL: container "${containerName}" not found at ${accountUrl}`);
    return 2;
  }

  let publicAccess: string | undefined;
  try {
    const props = await container.getAccessPolicy();
    publicAccess = props.blobPublicAccess ?? "none";
  } catch (e) {
    result.notes.push(`getAccessPolicy() error: ${(e as Error).message}`);
  }

  result.publicAccess = publicAccess ?? "unknown";
  if (publicAccess === undefined) {
    result.verdict = "UNKNOWN";
    result.exitCode = 2;
  } else if (publicAccess === "none") {
    result.verdict = "PRIVATE";
    result.exitCode = 0;
  } else {
    result.verdict = "PUBLIC";
    result.exitCode = 1;
    result.notes.push(
      `Container public access is "${publicAccess}". This exposes PHI. ` +
        `In the Azure Portal: Storage account > Containers > ${containerName} > ` +
        `Change access level > Private (no anonymous access).`,
    );
  }

  if (process.env.OUTPUT === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Account        : ${result.account}`);
    console.log(`Container      : ${result.container}`);
    console.log(`Public access  : ${result.publicAccess}`);
    console.log(`Verdict        : ${result.verdict}`);
    if (result.notes.length > 0) {
      console.log(`Notes          :`);
      for (const n of result.notes) {
        console.log(`  - ${n}`);
      }
    }
  }
  return result.exitCode;
}

main()
  .then((rc) => process.exit(rc))
  .catch((e) => {
    console.error("Unhandled error:", e);
    process.exit(2);
  });
