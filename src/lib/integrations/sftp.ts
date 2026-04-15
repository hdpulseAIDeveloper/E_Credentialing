/**
 * SFTP client for payer roster uploads.
 * Stub logs when SFTP_HOST is not set.
 */

const SFTP_HOST = process.env.SFTP_HOST;
const SFTP_PORT = parseInt(process.env.SFTP_PORT ?? "22", 10);
const SFTP_USERNAME = process.env.SFTP_USERNAME;
const SFTP_PASSWORD = process.env.SFTP_PASSWORD;

export interface SftpUploadResult {
  success: boolean;
  remotePath: string;
  message: string;
}

export async function uploadRoster(params: {
  payerName: string;
  remotePath: string;
  fileBuffer: Buffer;
  filename: string;
}): Promise<SftpUploadResult> {
  if (!SFTP_HOST) {
    console.warn(`[SFTP] SFTP_HOST not set — stub logging roster upload for ${params.payerName}: ${params.filename} (${params.fileBuffer.length} bytes)`);
    return {
      success: true,
      remotePath: params.remotePath + "/" + params.filename,
      message: `Stub: SFTP upload simulated for ${params.payerName}`,
    };
  }

  // Real implementation would use ssh2-sftp-client
  const SftpClient = (await import("ssh2-sftp-client")).default;
  const sftp = new SftpClient();

  try {
    await sftp.connect({
      host: SFTP_HOST,
      port: SFTP_PORT,
      username: SFTP_USERNAME,
      password: SFTP_PASSWORD,
    });

    const fullPath = `${params.remotePath}/${params.filename}`;
    await sftp.put(params.fileBuffer, fullPath);

    return { success: true, remotePath: fullPath, message: `Roster uploaded to ${fullPath}` };
  } finally {
    await sftp.end();
  }
}
