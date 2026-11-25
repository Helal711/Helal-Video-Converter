import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const binDir = path.resolve(process.cwd(), 'electron', 'resources', 'bin', 'win32-x64');
const requiredFiles = ['ffmpeg.exe', 'ffprobe.exe'];

const missing = [];
for (const file of requiredFiles) {
  const fullPath = path.join(binDir, file);
  if (!existsSync(fullPath) || statSync(fullPath).size < 1024 * 1024) {
    missing.push(fullPath);
  }
}

if (missing.length > 0) {
  console.error('\n[verify-win-binaries] Missing bundled Windows x64 FFmpeg binaries:');
  for (const item of missing) {
    console.error(`  - ${item}`);
  }
  console.error(
    '\nRun "npm run fetch:ffmpeg:win" (or copy verified Windows x64 ffmpeg.exe and ffprobe.exe into electron/resources/bin/win32-x64/) before packaging the Windows installer.\n',
  );
  process.exit(1);
}

console.log('[verify-win-binaries] Verified Windows x64 ffmpeg.exe and ffprobe.exe in:', binDir);
