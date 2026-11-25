import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-electron');

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });

  // 1. Compile main process and services via TypeScript
  const tscBin = path.join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
  );
  execFileSync(tscBin, ['-p', 'tsconfig.electron.json'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // 2. Bundle preload.ts into a single self-contained CJS file for Electron sandbox: true
  await build({
    entryPoints: [path.join(rootDir, 'electron', 'preload.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    outfile: path.join(outDir, 'preload.js'),
  });

  // 3. Mark dist-electron as CommonJS so root "type": "module" does not break Electron require()
  await fs.writeFile(
    path.join(outDir, 'package.json'),
    JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
    'utf-8',
  );

  console.log('[build:electron] Compiled main process and bundled sandboxed preload.js');
}

main().catch((err) => {
  console.error('[build:electron] Failed:', err);
  process.exit(1);
});
