import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface FileManifestEntry {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupManifest {
  timestamp: string;
  sourceDirectories: {
    data: string;
    uploads: string;
  };
  backupDirectory: string;
  files: Record<string, FileManifestEntry>;
  totalFiles: number;
  totalBytes: number;
}

export interface BackupResult {
  backupDir: string;
  manifestPath: string;
  manifest: BackupManifest;
  verified: boolean;
  error?: string;
}

/**
 * Computes the SHA-256 checksum of a file.
 */
export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Recursively collects files in a directory relative to the directory root.
 */
export function collectFiles(dirPath: string, rootDir: string = dirPath): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectFiles(fullPath, rootDir));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Creates a timestamped pre-flight backup of source directories (data/ and uploads/)
 * and generates a SHA-256 manifest. Verifies every file copy before returning.
 * Fails closed if verification fails.
 */
export function createPreFlightBackup(
  sourceDataDir: string,
  sourceUploadsDir: string,
  backupBaseDir: string = path.resolve(process.cwd(), 'backups')
): BackupResult {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupBaseDir, `pre_migration_${timestamp}`);
  const backupDataDir = path.join(backupDir, 'data');
  const backupUploadsDir = path.join(backupDir, 'uploads');

  fs.mkdirSync(backupDataDir, { recursive: true });
  fs.mkdirSync(backupUploadsDir, { recursive: true });

  const manifest: BackupManifest = {
    timestamp: new Date().toISOString(),
    sourceDirectories: {
      data: path.resolve(sourceDataDir),
      uploads: path.resolve(sourceUploadsDir)
    },
    backupDirectory: backupDir,
    files: {},
    totalFiles: 0,
    totalBytes: 0
  };

  const copyAndVerify = (sourceFiles: string[], srcRoot: string, destRoot: string, prefix: string) => {
    for (const srcFile of sourceFiles) {
      const relPath = path.relative(srcRoot, srcFile);
      const destFile = path.join(destRoot, relPath);

      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);

      const srcStats = fs.statSync(srcFile);
      const srcHash = computeFileSha256(srcFile);
      const destHash = computeFileSha256(destFile);

      if (srcHash !== destHash) {
        throw new Error(
          `Backup verification FAILED for file: ${relPath}. Source SHA-256 does not match backup copy!`
        );
      }

      const key = `${prefix}/${relPath.replace(/\\/g, '/')}`;
      manifest.files[key] = {
        relativePath: key,
        sizeBytes: srcStats.size,
        sha256: srcHash
      };
      manifest.totalFiles += 1;
      manifest.totalBytes += srcStats.size;
    }
  };

  try {
    const dataFiles = collectFiles(sourceDataDir);
    copyAndVerify(dataFiles, sourceDataDir, backupDataDir, 'data');

    const uploadFiles = collectFiles(sourceUploadsDir);
    copyAndVerify(uploadFiles, sourceUploadsDir, backupUploadsDir, 'uploads');

    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return {
      backupDir,
      manifestPath,
      manifest,
      verified: true
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      backupDir,
      manifestPath: '',
      manifest,
      verified: false,
      error: message
    };
  }
}

/**
 * Verifies an existing backup against its manifest.json.
 */
export function verifyBackupManifest(backupDir: string): { verified: boolean; discrepancies: string[] } {
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { verified: false, discrepancies: ['manifest.json not found in backup directory'] };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
  const discrepancies: string[] = [];

  for (const [key, entry] of Object.entries(manifest.files)) {
    const filePath = path.join(backupDir, key.replace(/\//g, path.sep));
    if (!fs.existsSync(filePath)) {
      discrepancies.push(`Missing file: ${key}`);
      continue;
    }
    const currentHash = computeFileSha256(filePath);
    if (currentHash !== entry.sha256) {
      discrepancies.push(`Hash mismatch for ${key}: expected ${entry.sha256}, got ${currentHash}`);
    }
  }

  return {
    verified: discrepancies.length === 0,
    discrepancies
  };
}

/**
 * Restores a backup to a designated target directory and verifies hash parity.
 * Used for testing restore procedures in a separate isolated directory.
 */
export function restoreBackupToDestination(
  backupDir: string,
  targetRestoreDir: string
): { success: boolean; restoredFiles: number; error?: string } {
  try {
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup manifest.json missing.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
    let count = 0;

    for (const [key, entry] of Object.entries(manifest.files)) {
      const srcFile = path.join(backupDir, key.replace(/\//g, path.sep));
      const destFile = path.join(targetRestoreDir, key.replace(/\//g, path.sep));

      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);

      const restoredHash = computeFileSha256(destFile);
      if (restoredHash !== entry.sha256) {
        throw new Error(`Restoration hash check failed for ${key}`);
      }
      count++;
    }

    return { success: true, restoredFiles: count };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, restoredFiles: 0, error: message };
  }
}
