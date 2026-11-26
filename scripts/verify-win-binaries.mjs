import { existsSync, lstatSync, openSync, readFileSync, readSync, closeSync, readdirSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const binDir = path.resolve(rootDir, 'electron', 'resources', 'bin', 'win32-x64');
const requiredFiles = ['ffmpeg.exe', 'ffprobe.exe'];
const checkPackagedOnly = process.argv.includes('--assets-only');

function isValidPeExecutable(filePath) {
  if (!existsSync(filePath)) return false;
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1024 * 1024) {
    return false;
  }
  const fd = openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(2);
    readSync(fd, header, 0, 2, 0);
    return header[0] === 0x4d && header[1] === 0x5a;
  } finally {
    closeSync(fd);
  }
}

function verifyPackagedAssets() {
  const requiredBuildFiles = [
    path.resolve(rootDir, 'dist', 'index.html'),
    path.resolve(rootDir, 'dist-electron', 'main.js'),
    path.resolve(rootDir, 'dist-electron', 'preload.js'),
    path.resolve(rootDir, 'dist-electron', 'package.json'),
    path.resolve(rootDir, 'build', 'icon.ico'),
  ];

  const missingBuild = requiredBuildFiles.filter((file) => !existsSync(file));
  if (missingBuild.length > 0) {
    console.error('\n[verify-win-binaries] Missing required packaged application assets:');
    for (const item of missingBuild) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  const distAssetsDir = path.resolve(rootDir, 'dist', 'assets');
  const assetFiles = existsSync(distAssetsDir) ? readdirSync(distAssetsDir) : [];
  const hasJs = assetFiles.some((f) => f.endsWith('.js'));
  const hasCss = assetFiles.some((f) => f.endsWith('.css'));
  if (!hasJs || !hasCss) {
    console.error('\n[verify-win-binaries] dist/assets is missing compiled JS or CSS bundles.');
    process.exit(1);
  }

  const indexHtml = readFileSync(path.resolve(rootDir, 'dist', 'index.html'), 'utf-8');
  if (indexHtml.includes('fonts.googleapis.com') || indexHtml.includes('fonts.gstatic.com')) {
    console.error('\n[verify-win-binaries] dist/index.html must not reference external font CDNs.');
    process.exit(1);
  }

  console.log('[verify-win-binaries] Verified dist/index.html, JS/CSS bundles, dist-electron/*, and build/icon.ico');
}

verifyPackagedAssets();

if (!checkPackagedOnly) {
  const invalid = [];
  for (const file of requiredFiles) {
    const fullPath = path.join(binDir, file);
    if (!isValidPeExecutable(fullPath)) {
      invalid.push(fullPath);
    }
  }

  if (invalid.length > 0) {
    console.error('\n[verify-win-binaries] Missing or invalid Windows x64 FFmpeg PE binaries:');
    for (const item of invalid) {
      console.error(`  - ${item}`);
    }
    console.error(
      '\nRun "npm run fetch:ffmpeg:win" (or copy verified Windows x64 ffmpeg.exe and ffprobe.exe into electron/resources/bin/win32-x64/) before packaging the Windows installer.\n',
    );
    process.exit(1);
  }

  console.log('[verify-win-binaries] Verified Windows x64 PE binaries ffmpeg.exe and ffprobe.exe in:', binDir);
}
