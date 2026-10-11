import fs from 'node:fs';
import path from 'node:path';

export interface FailedDeletionItem {
  file: string;
  error: string;
}

export interface ClearUploadsResult {
  success: boolean;
  filesDeleted: string[];
  failedDeletions: FailedDeletionItem[];
  error?: string;
}

/**
 * Validates that the provided directory is strictly a managed uploads directory
 * and NOT a critical application directory (like project root, data/, backups/, or system root).
 */
export function isSafeUploadDirectory(targetDir: string, allowedParentDir?: string): boolean {
  if (!targetDir || typeof targetDir !== 'string') return false;

  const resolved = path.resolve(targetDir);
  const root = path.parse(resolved).root;

  // 1. Never allow root directories (e.g. C:\ or /)
  if (resolved === root) return false;

  // 2. Never allow current project working directory directly
  const cwd = path.resolve(process.cwd());
  if (resolved === cwd) return false;

  // 3. Prohibit critical paths
  const baseName = path.basename(resolved).toLowerCase();
  const criticalDirs = ['data', 'backups', 'src', 'server', 'node_modules', '.git', 'dist'];
  if (criticalDirs.includes(baseName)) return false;

  // 4. Must be named 'uploads' or 'attachments' (or contain them when under an allowed parent)
  const isAllowedName =
    baseName === 'uploads' ||
    baseName === 'attachments' ||
    baseName.includes('uploads') ||
    baseName.includes('attachments');

  if (!isAllowedName) return false;

  // 5. If allowedParentDir is specified, ensure resolved target is within it
  if (allowedParentDir) {
    const resolvedParent = path.resolve(allowedParentDir);
    if (!resolved.startsWith(resolvedParent + path.sep)) {
      return false;
    }
  }

  return true;
}

/**
 * Recursively clears managed files in an uploads directory with path traversal and symlink guards.
 * Returns detailed audit of deleted files and any failures.
 */
export function clearManagedUploads(uploadsDir: string, allowedParentDir?: string): ClearUploadsResult {
  const result: ClearUploadsResult = {
    success: true,
    filesDeleted: [],
    failedDeletions: []
  };

  // 1. Safety check
  if (!isSafeUploadDirectory(uploadsDir, allowedParentDir)) {
    result.success = false;
    result.error = `Security Error: Refusing to clear unsafe directory: ${uploadsDir}`;
    return result;
  }

  // 2. If directory does not exist, return success cleanly
  if (!fs.existsSync(uploadsDir)) {
    return result;
  }

  const resolvedUploadsDir = path.resolve(uploadsDir);

  // 3. Recursive deletion function with symlink protection
  const removeContents = (currentDir: string): void => {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(currentDir);
    } catch (err: unknown) {
      result.failedDeletions.push({
        file: path.relative(resolvedUploadsDir, currentDir),
        error: err instanceof Error ? err.message : String(err)
      });
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const relativePath = path.relative(resolvedUploadsDir, fullPath);

      // Traversal guard: Ensure fullPath never escapes resolvedUploadsDir
      if (!fullPath.startsWith(resolvedUploadsDir + path.sep)) {
        result.failedDeletions.push({
          file: relativePath,
          error: 'Security Error: Path traversal attempt detected'
        });
        continue;
      }

      let lstat: fs.Stats;
      try {
        lstat = fs.lstatSync(fullPath);
      } catch (err: unknown) {
        result.failedDeletions.push({
          file: relativePath,
          error: err instanceof Error ? err.message : String(err)
        });
        continue;
      }

      // Symlink guard: Never follow symlinks outside; only unlink the symlink itself
      if (lstat.isSymbolicLink()) {
        try {
          fs.unlinkSync(fullPath);
          result.filesDeleted.push(relativePath);
        } catch (err: unknown) {
          result.failedDeletions.push({
            file: relativePath,
            error: err instanceof Error ? err.message : String(err)
          });
        }
        continue;
      }

      if (lstat.isDirectory()) {
        removeContents(fullPath);
        // Remove empty directory after deleting its contents
        try {
          fs.rmdirSync(fullPath);
        } catch (err: unknown) {
          result.failedDeletions.push({
            file: relativePath,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      } else if (lstat.isFile()) {
        try {
          fs.unlinkSync(fullPath);
          result.filesDeleted.push(relativePath);
        } catch (err: unknown) {
          result.failedDeletions.push({
            file: relativePath,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }
  };

  removeContents(resolvedUploadsDir);

  if (result.failedDeletions.length > 0) {
    result.success = false;
    result.error = `Failed to delete ${result.failedDeletions.length} file(s) in upload storage.`;
  }

  return result;
}
