# Security Summary

**Reviewed Files**: 29
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Unsolicited External Network Requests | `index.html` | 12 | Startup HTML requested external stylesheets and fonts from `fonts.googleapis.com` and `fonts.gstatic.com`. | Medium | Fixed | Removed external font CDN links and enforced strict local-only `connect-src 'none'` CSP headers in `electron/main.ts`. |
| Missing Content Security Policy & Navigation Guard | `electron/main.ts` | 14, 311, 531 | Main window blocked popups (`setWindowOpenHandler`) but lacked a strict CSP header, `will-navigate` restriction, and permission denial handlers. | Medium | Fixed | Enforced `PRODUCTION_CSP` on `app://bundle/*` responses, blocked cross-origin `will-navigate`, and denied all session permission requests. |
| Untrusted `VITE_DEV_SERVER_URL` & Unvalidated IPC Frame Origin | `electron/main.ts` | 89, 122 | `VITE_DEV_SERVER_URL` was read without checking `app.isPackaged` or localhost origin, and IPC handlers did not verify `event.senderFrame?.url`. | Medium | Fixed | Ignored `VITE_DEV_SERVER_URL` when `app.isPackaged` is true, restricted dev URLs to `localhost`/`127.0.0.1`, and enforced `assertTrustedIpcSender(event)` on all IPC handlers. |
| Unbounded Settings Payload Persistence | `electron/main.ts` | 225 | `settings:save` persisted arbitrary renderer JSON objects directly to `helal-settings.json`. | Low | Fixed | Added `sanitizeSettingsPayload` allowlisting only validated settings fields, enums, bounded worker counts, and null-byte-free strings. |
| Build Toolchains Packaged Into Desktop ASAR | `package.json`, `electron-builder.yml` | 15, 25 | Build-time packages (`vite`, `esbuild`, `@tailwindcss/vite`) and unused libraries were listed under `dependencies` and included in `app.asar`. | Medium | Fixed | Moved Vite/Tailwind build plugins to `devDependencies`, removed unused packages, and added `!node_modules/**/*` in `electron-builder.yml`. |
| Unverified FFmpeg Archive Checksum & ZIP Symlink Extraction | `scripts/fetch-win-ffmpeg.mjs` | 28, 134, 187 | Build script extracted downloaded ZIP archives without SHA-256 verification or `extract-zip` symlink entry filtering. | High | Fixed | Added official `gyan.dev` SHA-256 verification, `validateZipEntrySafety` symlink and traversal checks in `onEntry`, and Windows PE `MZ` header verification. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Renderer Sandbox Isolation | `electron/main.ts`, `electron/preload.ts` | Enforces `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and exposes only typed `contextBridge` methods. |
| Command Execution | `electron/services/ffmpegService.ts`, `electron/services/ffprobeService.ts` | Spawns `ffmpeg` and `ffprobe` strictly with argument arrays (`shell: false`, `windowsHide: true`) and validated binary names. |
| Output Path Confinement | `electron/services/pathValidator.ts` | Normalizes output paths with `path.resolve`, sanitizes filenames, rejects null bytes, and verifies `resolved.startsWith(baseDirWithSep)`. |
| Custom Protocol File Serving | `electron/main.ts` | Serves `app://bundle/*` read-only (`GET`/`HEAD`) strictly within resolved `dist/` via `targetPath.startsWith(distWithSep)`. |

## PoC Verification

### 1. Path Traversal & Symlink Entry in FFmpeg Archive Extraction
#### Summary
| Field | Value |
|---|---|
| Issue Type | Archive symlink / path-traversal extraction |
| Impact | High |
| Affected File | `scripts/fetch-win-ffmpeg.mjs:134` |
| Test Scenario | Malicious ZIP archive containing entry `../../Windows/System32/evil.exe` or a POSIX symlink entry (`mode & 0o170000 === 0o120000`) |

#### How It Was Fixed
Added official `.sha256` archive verification prior to extraction, an `onEntry` validation hook (`validateZipEntrySafety`) inside `extract-zip` that rejects symlinks, null bytes, absolute paths, and `..` segments before disk writes occur, plus `verifyPeExecutable` validation on extracted binaries.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Downloaded archive digest is compared against `ffmpeg-release-essentials.zip.sha256` at `scripts/fetch-win-ffmpeg.mjs:176-181` | Tampered archives abort before extraction |
| 2 | `extract-zip` invokes `onEntry: (entry) => validateZipEntrySafety(entry)` before writing any entry | Symlink (`0o120000`) or `..` / absolute entry throws immediately |
| 3 | Extracted executables are inspected by `verifyPeExecutable` (`scripts/fetch-win-ffmpeg.mjs:78-94`) | Rejects symlinks (`lstat`) and non-PE (`MZ`) files |

#### Conclusion
**Fix Verified** - Neither tampered archives nor symlink/traversal ZIP entries can write arbitrary files during FFmpeg staging.

### 2. Custom Protocol Traversal & Untrusted IPC Sender Origin
#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-origin IPC access and custom scheme directory escape |
| Impact | Medium |
| Affected File | `electron/main.ts:122`, `electron/main.ts:199` |
| Test Scenario | Request to `app://bundle/../../../Windows/win.ini` or an IPC call from a non-app origin (`https://evil.example/index.html`) |

#### How It Was Fixed
Added path normalization and `distWithSep` prefix confinement in `registerAppProtocol`, blocked external `will-navigate` targets, and enforced `assertTrustedIpcSender(event)` across every `ipcMain.handle` registration.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `app://bundle/../../../Windows/win.ini` is resolved via `path.resolve(distRoot, relativePath)` at `electron/main.ts:200` | Resolves outside `distRoot` |
| 2 | Boundary check `if (targetPath !== distRoot && !targetPath.startsWith(distWithSep))` triggers at `electron/main.ts:202` | Returns HTTP `403 Forbidden` |
| 3 | External IPC invocation enters `assertTrustedIpcSender(event)` at `electron/main.ts:122` | `isAllowedAppUrl(senderUrl)` returns `false` and throws immediately |

#### Conclusion
**Fix Verified** - Only files strictly under `dist/` are served over `app://bundle/`, and only the app origin can invoke privileged desktop IPC channels.
