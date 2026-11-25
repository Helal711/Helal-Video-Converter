import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const checkLockfileOnly = process.argv.includes('--lockfile');

const REQUIRED_WIN_LOCKFILE_PACKAGES = [
  'node_modules/@rolldown/binding-win32-x64-msvc',
  'node_modules/@esbuild/win32-x64',
  'node_modules/lightningcss-win32-x64-msvc',
  'node_modules/@tailwindcss/oxide-win32-x64-msvc',
  'node_modules/@typescript/typescript-win32-x64',
];

function verifyLockfileEntries() {
  const lockPath = path.resolve(process.cwd(), 'package-lock.json');
  if (!existsSync(lockPath)) {
    console.error('[verify-win-bindings] Missing package-lock.json.');
    process.exit(1);
  }

  const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
  const pkgs = lock.packages ?? {};
  const missing = REQUIRED_WIN_LOCKFILE_PACKAGES.filter((pkg) => !pkgs[pkg]);

  if (missing.length > 0) {
    console.error(
      '\n[verify-win-bindings] package-lock.json is missing required Windows x64 optional dependencies:',
    );
    for (const pkg of missing) {
      console.error(`  - ${pkg}`);
    }
    console.error(
      '\nRegenerate package-lock.json cleanly (without stale Linux-only node_modules) so Windows optional dependencies are included.\n',
    );
    process.exit(1);
  }

  console.log(
    '[verify-win-bindings] Verified Windows x64 optional dependencies in package-lock.json:',
    REQUIRED_WIN_LOCKFILE_PACKAGES.map((p) => p.replace('node_modules/', '')).join(', '),
  );
}

function verifyWindowsRuntimeBindings() {
  if (process.platform !== 'win32') {
    console.log(
      `[verify-win-bindings] Host platform is ${process.platform}; skipping live Windows .node binding load check.`,
    );
    return;
  }

  const requiredPackages = [
    { name: '@rolldown/binding-win32-x64-msvc', checkMain: true },
    { name: '@esbuild/win32-x64', checkMain: false },
    { name: 'lightningcss-win32-x64-msvc', checkMain: true },
    { name: '@tailwindcss/oxide-win32-x64-msvc', checkMain: true },
    { name: '@typescript/typescript-win32-x64', checkMain: false },
  ];

  const failures = [];
  for (const pkg of requiredPackages) {
    try {
      const pkgJsonPath = require.resolve(`${pkg.name}/package.json`);
      if (pkg.checkMain) {
        const entryPath = require.resolve(pkg.name);
        if (!existsSync(entryPath)) {
          throw new Error(`Resolved entry does not exist: ${entryPath}`);
        }
        console.log(`[verify-win-bindings] Resolved ${pkg.name} -> ${entryPath}`);
      } else {
        console.log(`[verify-win-bindings] Resolved ${pkg.name} -> ${pkgJsonPath}`);
      }
    } catch (err) {
      failures.push({
        modName: pkg.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length > 0) {
    console.error('\n[verify-win-bindings] Native Windows binding resolution failed:');
    for (const f of failures) {
      console.error(`  - ${f.modName}: ${f.reason}`);
    }
    console.error(
      '\nEnsure npm installed optional dependencies cleanly with "npm ci --include=optional" and that package-lock.json includes Windows x64 bindings.\n',
    );
    process.exit(1);
  }
}

verifyLockfileEntries();
if (!checkLockfileOnly) {
  verifyWindowsRuntimeBindings();
}
