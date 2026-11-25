# Helal Video Converter — Desktop Architecture

## Runtime Separation
- **`src/` (Renderer / UI + Pure Client Core)**
  - `src/types/`: Strict TypeScript interfaces for media items, presets, conversion configurations, real-time progress, settings, history, and `window.electronAPI`.
  - `src/core/`: Pure business logic decoupled from React UI components (`modules.ts`, `presets.ts`, `conversionConfig.ts`, `mediaInspector.ts`, `desktopBridge.ts`, `storage.ts`).
  - `src/components/`: Modular UI components (`layout/`, `common/`, `dashboard/`, `modules/`).
- **`electron/` (Desktop Main & Preload Architecture)**
  - `electron/main.ts`: Creates `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Registers validated IPC handlers.
  - `electron/preload.ts`: Exposes whitelisted `window.electronAPI` methods and `webUtils.getPathForFile` via `contextBridge.exposeInMainWorld`.
  - `electron/ipc/channels.ts`: Centralized IPC channel constants.
  - `electron/services/binaryManager.ts`: Resolves FFmpeg/FFprobe from configured path, bundled `resources/bin/win32-x64/`, or system `PATH`, and verifies `-version`.
  - `electron/services/pathValidator.ts`: Enforces absolute paths, regular-file checks, filename sanitization, output directory traversal confinement, and `rename`/`overwrite`/`skip` policy.
  - `electron/services/conversionBuilder.ts`: Validates container/codec/resolution/quality configurations against strict allowlists and produces safe `spawn()` argument arrays.
  - `electron/services/ffprobeService.ts`: Invokes local `ffprobe` safely (`shell: false`) to extract container format, duration, size, video/audio codecs, resolution, FPS, bitrate, and audio channels.
  - `electron/services/ffmpegService.ts`: Invokes local `ffmpeg` safely (`shell: false`, `-progress pipe:1`) with buffered progress/ETA/size reporting, output file validation, and `SIGTERM`->`SIGKILL` cancellation.
  - `electron/services/queueManager.ts`: Manages bounded concurrency workers (`maxConcurrentJobs`), failure isolation, and per-job or batch cancellation.

## Documented IPC Channels
- `app:get-runtime-capabilities` -> Returns Electron sandbox state + FFmpeg/FFprobe binary paths, sources, and versions.
- `dialog:select-media-files` -> Native multi-file open dialog returning path, name, size, and extension.
- `dialog:select-output-directory` -> Native folder picker for default output directory.
- `media:probe-file` -> Runs `ffprobe` on a validated absolute file path and returns `NormalizedMediaProbe`.
- `queue:start` -> Validates and starts queued jobs through `ConversionQueueManager`.
- `queue:cancel-job` -> Cancels a specific queued or active job by `jobId`.
- `queue:cancel-all` -> Cancels all pending and active jobs.
- `queue:job-progress` -> Main-to-renderer push event (`percent`, `elapsedSeconds`, `etaSeconds`, `speed`, `outputSizeBytes`).
- `queue:job-status` -> Main-to-renderer push event (`processing`, `completed`, `failed`, `cancelled`, `skipped`).
- `shell:open-path` / `shell:reveal-file` -> Opens validated output folder or reveals output file in Windows Explorer.
- `settings:load` / `settings:save` -> Persists desktop preferences under Electron `userData`.

## Running on Windows (Electron Desktop)
1. Install dependencies from `package-lock.json` in PowerShell / VS Code:
   ```bash
   npm ci
   ```
2. Fetch Windows x64 `ffmpeg.exe` and `ffprobe.exe` into `electron/resources/bin/win32-x64/` (or install FFmpeg in Windows `PATH`, or configure paths in Settings). Review `electron/resources/FFMPEG_LICENSE.md` before redistribution:
   ```bash
   npm run fetch:ffmpeg:win
   ```
3. Compile Vite renderer and Electron main/preload processes:
   ```bash
   npm run build:all
   ```
4. Launch Electron locally (`npx electron dist-electron/main.js`) or build Windows installers (`npm run dist:win` / `npm run dist:portable`).
