/**
 * Azure Blob Storage client for document storage.
 * Replaces K: drive for all PDFs, verification outputs, and bot artifacts.
 */

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  ContainerClient,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

let _blobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (_blobServiceClient) return _blobServiceClient;

  const accountUrl = process.env.AZURE_BLOB_ACCOUNT_URL;

  if (accountUrl) {
    // Production: use Managed Identity / DefaultAzureCredential
    _blobServiceClient = new BlobServiceClient(
      accountUrl,
      new DefaultAzureCredential()
    );
  } else {
    throw new Error(
      "AZURE_BLOB_ACCOUNT_URL must be set for blob storage operations"
    );
  }

  return _blobServiceClient;
}

function getContainerName(): string {
  return process.env.AZURE_BLOB_CONTAINER ?? "essen-credentialing";
}

/**
 * Uploads a document buffer to Azure Blob Storage.
 * Returns the blob URL.
 */
export async function uploadDocument(params: {
  blobPath: string;
  content: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(getContainerName());

  const blockBlobClient = containerClient.getBlockBlobClient(params.blobPath);

  await blockBlobClient.upload(params.content, params.content.length, {
    blobHTTPHeaders: { blobContentType: params.contentType },
    metadata: params.metadata,
  });

  return blockBlobClient.url;
}

/**
 * Downloads a document from Azure Blob Storage as a Buffer.
 */
export async function downloadDocument(blobPath: string): Promise<Buffer> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(getContainerName());
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  const downloadResponse = await blockBlobClient.download();

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }

  return Buffer.concat(chunks);
}

/**
 * Generates a time-limited SAS URL for a blob (for browser downloads).
 * Default expiry: 1 hour.
 */
export async function generateSasUrl(
  blobPath: string,
  expiryMinutes = 60
): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(getContainerName());
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  // For user delegation SAS with DefaultAzureCredential:
  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

  // Generate user delegation key
  const userDelegationKey = await client.getUserDelegationKey(
    new Date(),
    expiresOn
  );

  const accountName = new URL(client.url).hostname.split(".")[0];

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName: getContainerName(),
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"),
      expiresOn,
    },
    userDelegationKey,
    accountName!
  );

  return `${blockBlobClient.url}?${sasQueryParams.toString()}`;
}

/**
 * Deletes a blob from Azure Blob Storage.
 */
export async function deleteDocument(blobPath: string): Promise<void> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(getContainerName());
  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  await blockBlobClient.deleteIfExists();
}

/**
 * Lists all blobs under a given prefix (e.g., for a provider's documents).
 */
export async function listBlobs(prefix: string): Promise<string[]> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(getContainerName());

  const blobNames: string[] = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobNames.push(blob.name);
  }
  return blobNames;
}
