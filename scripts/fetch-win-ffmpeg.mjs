import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const FFMPEG_ZIP_URL =
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

const targetDir = path.resolve(process.cwd(), 'electron', 'resources', 'bin', 'win32-x64');
const tempDir = path.join(targetDir, '_tmp_extract');
const zipPath = path.join(targetDir, 'ffmpeg-release-essentials.zip');

async function downloadFile(url, dest) {
  console.log(`[fetch:ffmpeg:win] Downloading ${url} ...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const readable = Readable.fromWeb(response.body);
  await pipeline(readable, createWriteStream(dest));
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

async function main() {
  await fs.mkdir(targetDir, { recursive: true });

  const ffmpegOut = path.join(targetDir, 'ffmpeg.exe');
  const ffprobeOut = path.join(targetDir, 'ffprobe.exe');
  if (existsSync(ffmpegOut) && existsSync(ffprobeOut)) {
    console.log('[fetch:ffmpeg:win] ffmpeg.exe and ffprobe.exe already present.');
    return;
  }

  await downloadFile(FFMPEG_ZIP_URL, zipPath);
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempDir}" -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', tempDir], { stdio: 'inherit' });
  }

  const ffmpegSrc = await findFileRecursive(tempDir, 'ffmpeg.exe');
  const ffprobeSrc = await findFileRecursive(tempDir, 'ffprobe.exe');
  const licenseSrc = await findFileRecursive(tempDir, 'LICENSE');

  if (!ffmpegSrc || !ffprobeSrc) {
    throw new Error('Could not locate ffmpeg.exe or ffprobe.exe inside downloaded archive.');
  }

  await fs.copyFile(ffmpegSrc, ffmpegOut);
  await fs.copyFile(ffprobeSrc, ffprobeOut);
  if (licenseSrc) {
    await fs.copyFile(licenseSrc, path.join(targetDir, 'FFMPEG_BINARY_LICENSE.txt'));
  }

  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });

  console.log('[fetch:ffmpeg:win] Bundled Windows x64 binaries ready in:', targetDir);
}

main().catch((err) => {
  console.error('[fetch:ffmpeg:win] Failed:', err);
  process.exit(1);
});
