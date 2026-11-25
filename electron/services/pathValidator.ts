import { existsSync, promises as fs } from 'fs';
import path from 'path';

export type ExistingFilePolicy = 'rename' | 'overwrite' | 'skip';

const ALLOWED_CONTAINER_EXTENSIONS = new Set([
  'mp4',
  'mkv',
  'avi',
  'mov',
  'webm',
]);

const ALLOWED_INPUT_EXTENSIONS = new Set([
  'mp4',
  'mkv',
  'mov',
  'avi',
  'webm',
  'wmv',
  'flv',
  'm4v',
  'ts',
  'mts',
  '3gp',
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'opus',
  'wma',
  'aiff',
]);

export interface SafeOutputPlan {
  action: 'proceed' | 'skip';
  outputPath: string;
  overwriteFlag: '-y' | '-n' | null;
}

export async function validateInputMediaPath(rawPath: unknown): Promise<string> {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    throw new Error('Input file path is required.');
  }
  if (rawPath.includes('\0')) {
    throw new Error('Invalid null byte detected in input path.');
  }
  if (!path.isAbsolute(rawPath)) {
    throw new Error('Input file path must be an absolute filesystem path.');
  }

  const resolved = path.resolve(rawPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Input media file does not exist: ${resolved}`);
  }
  if (stat.size <= 0) {
    throw new Error(`Input media file is empty (0 bytes): ${resolved}`);
  }

  const ext = path.extname(resolved).replace('.', '').toLowerCase();
  if (!ext || !ALLOWED_INPUT_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported media file extension ".${ext || 'unknown'}".`);
  }

  return resolved;
}

export async function validateOutputDirectory(rawDir: unknown): Promise<string> {
  if (typeof rawDir !== 'string' || !rawDir.trim()) {
    throw new Error('Output directory path is required.');
  }
  if (rawDir.includes('\0')) {
    throw new Error('Invalid null byte detected in output directory path.');
  }
  if (!path.isAbsolute(rawDir)) {
    throw new Error('Output directory must be an absolute filesystem path.');
  }

  const resolved = path.resolve(rawDir);
  await fs.mkdir(resolved, { recursive: true });
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Output path is not a directory: ${resolved}`);
  }

  return resolved;
}

function sanitizeBaseFilename(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  const cleaned = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return cleaned || 'converted_media';
}

export function buildSafeOutputPath(
  validatedInputPath: string,
  validatedOutputDir: string,
  targetContainer: string,
  policy: ExistingFilePolicy,
): SafeOutputPlan {
  const normalizedContainer = targetContainer.toLowerCase().trim();
  if (!ALLOWED_CONTAINER_EXTENSIONS.has(normalizedContainer)) {
    throw new Error(`Unsupported target container "${targetContainer}".`);
  }

  const safeBase = sanitizeBaseFilename(validatedInputPath);
  const baseDirWithSep = validatedOutputDir.endsWith(path.sep)
    ? validatedOutputDir
    : `${validatedOutputDir}${path.sep}`;

  const buildCandidate = (suffix: string): string => {
    const candidateName = `${safeBase}${suffix}.${normalizedContainer}`;
    const resolved = path.resolve(validatedOutputDir, candidateName);
    if (!resolved.startsWith(baseDirWithSep)) {
      throw new Error('Path traversal prevented: resolved output escapes output directory.');
    }
    return resolved;
  };

  let targetPath = buildCandidate('');

  // Never overwrite the exact source file in-place
  if (targetPath === validatedInputPath && policy === 'overwrite') {
    targetPath = buildCandidate('_converted');
  }

  if (policy === 'skip') {
    if (existsSync(targetPath)) {
      return {
        action: 'skip',
        outputPath: targetPath,
        overwriteFlag: null,
      };
    }
    return {
      action: 'proceed',
      outputPath: targetPath,
      overwriteFlag: '-n',
    };
  }

  if (policy === 'overwrite') {
    return {
      action: 'proceed',
      outputPath: targetPath,
      overwriteFlag: '-y',
    };
  }

  // Default: auto-rename (_1, _2, ...)
  if (!existsSync(targetPath) && targetPath !== validatedInputPath) {
    return {
      action: 'proceed',
      outputPath: targetPath,
      overwriteFlag: '-n',
    };
  }

  for (let i = 1; i <= 9999; i++) {
    const candidate = buildCandidate(`_${i}`);
    if (!existsSync(candidate) && candidate !== validatedInputPath) {
      return {
        action: 'proceed',
        outputPath: candidate,
        overwriteFlag: '-n',
      };
    }
  }

  throw new Error('Could not determine a unique output filename after 9999 attempts.');
}
