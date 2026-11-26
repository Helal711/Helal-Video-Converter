import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import extract from 'extract-zip';

const FFMPEG_ZIP_URL =
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const FFMPEG_SHA256_URL =
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256';

const targetDir = path.resolve(process.cwd(), 'electron', 'resources', 'bin', 'win32-x64');
const tempDir = path.join(targetDir, '_tmp_extract');
const zipPath = path.join(targetDir, 'ffmpeg-release-essentials.zip');

async function computeSha256(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex').toLowerCase();
}

async function fetchExpectedSha256(url) {
  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    throw new Error(
      `Failed to fetch FFmpeg SHA-256 checksum from ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to download FFmpeg SHA-256 checksum from ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.text()).trim();
  const match = body.match(/^[a-fA-F0-9]{64}/);
  if (!match) {
    throw new Error(`Unexpected SHA-256 checksum payload from ${url}: "${body.slice(0, 120)}"`);
  }
  return match[0].toLowerCase();
}

async function downloadFile(url, dest) {
  console.log(`[fetch:ffmpeg:win] Downloading ${url} ...`);
  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    throw new Error(
      `Network request to ${url} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download FFmpeg archive from ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  try {
    const readable = Readable.fromWeb(response.body);
    await pipeline(readable, createWriteStream(dest));
  } catch (err) {
    await fs.rm(dest, { force: true }).catch(() => undefined);
    throw new Error(
      `Failed while writing FFmpeg archive to "${dest}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const stat = await fs.stat(dest).catch(() => null);
  if (!stat || !stat.isFile() || stat.size < 1024 * 1024) {
    await fs.rm(dest, { force: true }).catch(() => undefined);
    throw new Error(
      `Downloaded FFmpeg archive at "${dest}" is missing or unexpectedly small (${
        stat ? stat.size : 0
      } bytes).`,
    );
  }
}

async function verifyPeExecutable(filePath) {
  const lstat = await fs.lstat(filePath);
  if (!lstat.isFile() || lstat.isSymbolicLink() || lstat.size < 1024 * 1024) {
    throw new Error(`Invalid binary file or unexpected symlink at "${filePath}".`);
  }
  const handle = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(2);
    await handle.read(header, 0, 2, 0);
    if (header[0] !== 0x4d || header[1] !== 0x5a) {
      throw new Error(`"${filePath}" is not a valid Windows PE executable (missing MZ header).`);
    }
  } finally {
    await handle.close();
  }
}

async function findFileRecursive(dir, filename) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFileRecursive(full, filename);
      if (found) return found;
    } else if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
      return full;
    }
  }
  return null;
}

async function findLicenseFilesRecursive(dir) {
  const matches = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findLicenseFilesRecursive(full)));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (
        lower === 'license' ||
        lower === 'license.txt' ||
        lower.startsWith('copying')
      ) {
        matches.push(full);
      }
    }
  }
  return matches;
}

function validateZipEntrySafety(entry) {
  const name = entry.fileName;
  if (!name || name.includes('\0') || path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) {
    throw new Error(`Unsafe ZIP entry path rejected: "${name}"`);
  }
  const normalized = path.posix.normalize(name.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`ZIP path traversal entry rejected: "${name}"`);
  }
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const IFMT = 0o170000;
  const IFLNK = 0o120000;
  if ((mode & IFMT) === IFLNK) {
    throw new Error(`ZIP symlink entry rejected for security: "${name}"`);
  }
}

async function main() {
  await fs.mkdir(targetDir, { recursive: true });

  const ffmpegOut = path.join(targetDir, 'ffmpeg.exe');
  const ffprobeOut = path.join(targetDir, 'ffprobe.exe');

  if (existsSync(ffmpegOut) && existsSync(ffprobeOut)) {
    try {
      await Promise.all([verifyPeExecutable(ffmpegOut), verifyPeExecutable(ffprobeOut)]);
      console.log('[fetch:ffmpeg:win] Verified ffmpeg.exe and ffprobe.exe already present.');
      return;
    } catch {
      // Re-download if existing file is invalid
    }
  }

  try {
    const [expectedSha256] = await Promise.all([
      fetchExpectedSha256(FFMPEG_SHA256_URL),
      downloadFile(FFMPEG_ZIP_URL, zipPath),
    ]);

    const actualSha256 = await computeSha256(zipPath);
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `FFmpeg ZIP SHA-256 mismatch! Expected ${expectedSha256}, got ${actualSha256}`,
      );
    }
    console.log(`[fetch:ffmpeg:win] Verified archive SHA-256: ${actualSha256}`);

    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });

    console.log('[fetch:ffmpeg:win] Extracting archive using extract-zip (symlink-guarded) ...');
    try {
      await extract(zipPath, {
        dir: tempDir,
        onEntry: (entry) => validateZipEntrySafety(entry),
      });
    } catch (err) {
      throw new Error(
        `Failed to extract FFmpeg ZIP archive "${zipPath}" into "${tempDir}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const ffmpegSrc = await findFileRecursive(tempDir, 'ffmpeg.exe');
    const ffprobeSrc = await findFileRecursive(tempDir, 'ffprobe.exe');

    if (!ffmpegSrc || !ffprobeSrc) {
      throw new Error(
        'Could not locate ffmpeg.exe or ffprobe.exe inside extracted FFmpeg archive.',
      );
    }

    await fs.copyFile(ffmpegSrc, ffmpegOut);
    await fs.copyFile(ffprobeSrc, ffprobeOut);

    await Promise.all([verifyPeExecutable(ffmpegOut), verifyPeExecutable(ffprobeOut)]);

    const licenseFiles = await findLicenseFilesRecursive(tempDir);
    if (licenseFiles.length > 0) {
      await fs.copyFile(
        licenseFiles[0],
        path.join(targetDir, 'FFMPEG_BINARY_LICENSE.txt'),
      );
      for (const extraLicense of licenseFiles.slice(1)) {
        const destName = `FFMPEG_${path.basename(extraLicense)}`;
        await fs.copyFile(extraLicense, path.join(targetDir, destName));
      }
    }

    const [ffmpegSha, ffprobeSha] = await Promise.all([
      computeSha256(ffmpegOut),
      computeSha256(ffprobeOut),
    ]);

    console.log('[fetch:ffmpeg:win] Bundled Windows x64 binaries verified in:', targetDir);
    console.log(`[fetch:ffmpeg:win] ffmpeg.exe  SHA-256: ${ffmpegSha}`);
    console.log(`[fetch:ffmpeg:win] ffprobe.exe SHA-256: ${ffprobeSha}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.rm(zipPath, { force: true }).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(
    '[fetch:ffmpeg:win] Failed:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
