/**
 * Wave 5.4 — auditor-package manifest types.
 *
 * The manifest is the machine-readable index of every artifact in an
 * auditor package. Auditors get a JSON they can diff between exports
 * to confirm we didn't change history.
 *
 * Anti-weakening:
 *   - Manifest fields are append-only. Renaming or removing a field
 *     breaks every auditor's downstream tooling. Add a new field
 *     instead.
 *   - `digestSha256` MUST be computed over the raw bytes of the file
 *     as written into the zip — never over a serialized form.
 */

export interface AuditorManifestArtifact {
  /** Path within the zip, posix-style. */
  path: string;
  /** Short human description for the auditor. */
  description: string;
  /** SHA-256 of the file's raw bytes, lower-case hex. */
  digestSha256: string;
  /** Size in bytes (matches the bytes in the zip entry). */
  bytes: number;
}

export interface AuditorManifest {
  /** ISO-8601 timestamp the package was built. */
  generatedAt: string;
  /** SemVer-like version of the package format. Bumped on shape changes. */
  packageFormatVersion: "1.0.0";
  organizationId: string;
  organizationName: string;
  /**
   * Optional reporting period. When supplied, the package only
   * contains audit log rows whose `timestamp` falls inside this
   * window.
   */
  reportPeriod?: {
    fromIso: string;
    toIso: string;
  };
  /** Quick dashboard the auditor sees in the cover sheet. */
  summary: {
    auditLogRows: number;
    auditChainOk: boolean;
    auditChainNullHashes: number;
    ncqaSnapshotCount: number;
    providerCount: number;
    licenseCount: number;
  };
  artifacts: AuditorManifestArtifact[];
}

/**
 * Render a stable, sorted-by-path JSON for the manifest so that
 * byte-for-byte reproducibility holds across runs.
 */
export function renderManifest(manifest: AuditorManifest): string {
  const sortedArtifacts = [...manifest.artifacts].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  const out: AuditorManifest = { ...manifest, artifacts: sortedArtifacts };
  return JSON.stringify(out, null, 2) + "\n";
}
