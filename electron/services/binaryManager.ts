import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import path from 'path';

export type BinaryTool = 'ffmpeg' | 'ffprobe';
export type BinarySource = 'configured' | 'bundled' | 'system-path' | 'missing';

export interface BinaryResolution {
  tool: BinaryTool;
  available: boolean;
  resolvedPath: string | null;
  source: BinarySource;
  version: string | null;
  error: string | null;
}

function getExecutableName(tool: BinaryTool): string {
  return process.platform === 'win32' ? `${tool}.exe` : tool;
}

function getBundledBinaryCandidates(tool: BinaryTool): string[] {
  const exeName = getExecutableName(tool);
  const archFolder =
    process.platform === 'win32'
      ? process.arch === 'arm64'
        ? 'win32-arm64'
        : 'win32-x64'
      : `${process.platform}-${process.arch}`;

  const candidates: string[] = [];

  // Packaged Electron resourcesPath (extraResources -> bin/win32-x64/ffmpeg.exe)
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, 'bin', archFolder, exeName));
    candidates.push(path.join(resourcesPath, 'bin', exeName));
  }

  // Local development workspace paths
  candidates.push(path.resolve(process.cwd(), 'electron', 'resources', 'bin', archFolder, exeName));
  candidates.push(path.resolve(process.cwd(), 'resources', 'bin', archFolder, exeName));
  if (typeof __dirname !== 'undefined') {
    candidates.push(path.resolve(__dirname, '..', 'resources', 'bin', archFolder, exeName));
  }

  return candidates;
}

function isUsableBinaryFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function isAllowedBinaryOverride(configuredPath: string, tool: BinaryTool): boolean {
  const trimmed = configuredPath.trim();
  if (!trimmed || trimmed.includes('\0')) return false;

  const base = path.basename(trimmed).toLowerCase();
  return (
    base === tool ||
    base === `${tool}.exe` ||
    base.startsWith(`${tool}-`) ||
    base.startsWith(`${tool}_`)
  );
}

export function probeBinaryVersion(executablePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    let child;
    try {
      child = spawn(executablePath, ['-version'], {
        windowsHide: true,
        shell: false,
      });
    } catch {
      finish(null);
      return;
    }

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore kill error
      }
      finish(null);
    }, 4000);

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < 2048) {
        stdout += chunk.toString('utf-8');
      }
    });

    child.on('error', () => {
      clearTimeout(timeout);
      finish(null);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        finish(null);
        return;
      }
      const firstLine = stdout.split(/\r?\n/)[0]?.trim() ?? null;
      finish(firstLine || null);
    });
  });
}

export async function resolveAndVerifyBinary(
  tool: BinaryTool,
  configuredPath?: string,
): Promise<BinaryResolution> {
  const exeName = getExecutableName(tool);

  // 1. User-configured explicit binary path
  if (configuredPath && configuredPath.trim()) {
    const trimmed = configuredPath.trim();
    // Ignore default bare names like "ffmpeg.exe" when checking explicit filesystem override
    const isExplicitPath = path.isAbsolute(trimmed) || trimmed.includes(path.sep) || trimmed.includes('/');

    if (isExplicitPath) {
      if (!isAllowedBinaryOverride(trimmed, tool)) {
        return {
          tool,
          available: false,
          resolvedPath: null,
          source: 'missing',
          version: null,
          error: `Configured ${tool} path must point to a valid ${exeName} executable.`,
        };
      }
      const normalized = path.resolve(trimmed);
      if (isUsableBinaryFile(normalized)) {
        const version = await probeBinaryVersion(normalized);
        if (version) {
          return {
            tool,
            available: true,
            resolvedPath: normalized,
            source: 'configured',
            version,
            error: null,
          };
        }
        return {
          tool,
          available: false,
          resolvedPath: normalized,
          source: 'missing',
          version: null,
          error: `Configured ${tool} binary at "${normalized}" failed to execute "-version".`,
        };
      }
      return {
        tool,
        available: false,
        resolvedPath: null,
        source: 'missing',
        version: null,
        error: `Configured ${tool} binary was not found at "${normalized}".`,
      };
    }
  }

  // 2. Bundled Windows x64 / platform binary inside app resources
  for (const candidate of getBundledBinaryCandidates(tool)) {
    if (isUsableBinaryFile(candidate)) {
      const version = await probeBinaryVersion(candidate);
      if (version) {
        return {
          tool,
          available: true,
          resolvedPath: candidate,
          source: 'bundled',
          version,
          error: null,
        };
      }
    }
  }

  // 3. System PATH fallback
  const systemVersion = await probeBinaryVersion(exeName);
  if (systemVersion) {
    return {
      tool,
      available: true,
      resolvedPath: exeName,
      source: 'system-path',
      version: systemVersion,
      error: null,
    };
  }

  return {
    tool,
    available: false,
    resolvedPath: null,
    source: 'missing',
    version: null,
    error: `${exeName} was not found in bundled resources or system PATH. Place Windows x64 binaries in "resources/bin/win32-x64/" or configure the executable path in Settings.`,
  };
}
