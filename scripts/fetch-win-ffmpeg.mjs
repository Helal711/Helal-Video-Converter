import { createWriteStream, existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import extract from 'extract-zip';

const FFMPEG_ZIP_URL =
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

const targetDir = path.resolve(process.cwd(), 'electron', 'resources', 'bin', 'win32-x64');
const tempDir = path.join(targetDir, '_tmp_extract');
const zipPath = path.join(targetDir, 'ffmpeg-release-essentials.zip');

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

async function findFileRecursive(dir, filename) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFileRecursive(full, filename);
      if (found) return found;
    } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
      return full;
    }
  }
  return null;
}

async function findLicenseFilesRecursive(dir) {
  const matches = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findLicenseFilesRecursive(full)));
    } else {
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

async function main() {
  await fs.mkdir(targetDir, { recursive: true });

  const ffmpegOut = path.join(targetDir, 'ffmpeg.exe');
  const ffprobeOut = path.join(targetDir, 'ffprobe.exe');

  if (existsSync(ffmpegOut) && existsSync(ffprobeOut)) {
    const [ffmpegStat, ffprobeStat] = await Promise.all([
      fs.stat(ffmpegOut).catch(() => null),
      fs.stat(ffprobeOut).catch(() => null),
    ]);
    if (
      ffmpegStat &&
      ffprobeStat &&
      ffmpegStat.size > 1024 * 1024 &&
      ffprobeStat.size > 1024 * 1024
    ) {
      console.log('[fetch:ffmpeg:win] ffmpeg.exe and ffprobe.exe already present.');
      return;
    }
  }

  try {
    await downloadFile(FFMPEG_ZIP_URL, zipPath);

    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });

    console.log('[fetch:ffmpeg:win] Extracting archive using extract-zip ...');
    try {
      await extract(zipPath, { dir: tempDir });
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

    const [ffmpegFinal, ffprobeFinal] = await Promise.all([
      fs.stat(ffmpegOut),
      fs.stat(ffprobeOut),
    ]);

    if (ffmpegFinal.size < 1024 * 1024 || ffprobeFinal.size < 1024 * 1024) {
      throw new Error(
        'Copied FFmpeg executables failed size verification after extraction.',
      );
    }

    console.log('[fetch:ffmpeg:win] Bundled Windows x64 binaries ready in:', targetDir);
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
