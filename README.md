# Helal Video Converter

A local-first Windows desktop video and audio processing workstation built with **Electron**, **React**, **TypeScript**, **Vite**, **FFmpeg**, and **FFprobe**.

All media inspection and transcoding execute locally on your machine using `child_process.spawn` with argument arrays—no cloud processing, no paid APIs, and no internet connection required during conversion.

## Features

- **Workstation Dashboard**: Drag-and-drop or native file-dialog intake, queue staging, and host runtime diagnostics.
- **FFprobe Metadata Extraction**: Reads container format, duration, file size, video/audio codecs, resolution, frame rate, bitrate, and audio channels/layout.
- **Video Converter**: Transcode between **MP4**, **MKV**, **AVI**, **MOV**, and **WebM** using **H.264**, **H.265 / HEVC**, and **VP9** video codecs alongside **AAC**, **MP3**, **FLAC**, and **Opus** audio codecs.
- **Resolution & Quality Controls**: Scale to `Original`, `480p`, `720p`, `1080p`, `1440p`, or `2160p (4K)` with `Low`, `Medium`, `High`, or `Custom` CRF/bitrate/speed settings.
- **Concurrent Queue & Real-Time Progress**: Bounded multi-worker queue with real FFmpeg percentage, elapsed time, ETA, live output file size, per-job cancellation, and failure isolation.
- **Dark & Light Desktop Themes**: Persistent appearance, default output folder, binary paths, hardware acceleration preference, and Conversion History ledger.
- **Security Hardened**: Enforces `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, whitelisted `contextBridge` IPC channels, main-process path validation, and `shell: false` spawning.

## Architecture

- `src/`: React + TypeScript UI (`components/`), pure client domain logic (`core/`), and shared types (`types/`).
- `electron/`: Secure Electron main process (`main.ts`), sandboxed preload (`preload.ts`), IPC channel definitions (`ipc/channels.ts`), and local FFmpeg/FFprobe engine (`services/`).
- `scripts/`: Electron build (`build-electron.mjs`), Windows FFmpeg fetcher (`fetch-win-ffmpeg.mjs`), binary verification (`verify-win-binaries.mjs`), and icon generator (`generate-win-icon.mjs`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed IPC channel documentation.

## Development Setup

### Prerequisites
- **Node.js 20+** and **npm**
- **FFmpeg & FFprobe** (either placed in `electron/resources/bin/win32-x64/`, installed on system `PATH`, or configured in **Settings**)

### Install Dependencies

```bash
npm ci
```

### Run Web Preview (Vite)

```bash
npm run dev
```

### Build Electron + Renderer

```bash
npm run build:all
```

### Run Local FFmpeg Integration Tests

Requires `ffmpeg` and `ffprobe` available in `PATH` or configured in `electron/resources/bin/`:

```bash
npm run test:ffmpeg
```

## Building Windows Installers (Windows 10 / 11 x64)

1. Download and stage official Windows x64 `ffmpeg.exe` and `ffprobe.exe` into `electron/resources/bin/win32-x64/`:

   ```powershell
   npm run fetch:ffmpeg:win
   ```

   *(Review [electron/resources/FFMPEG_LICENSE.md](./electron/resources/FFMPEG_LICENSE.md) before redistributing FFmpeg binaries.)*

2. Build the NSIS Setup installer (`release/Helal-Video-Converter-Setup.exe`):

   ```powershell
   npm run dist:win
   ```

3. Build the Portable executable (`release/Helal-Video-Converter-Portable.exe`):

   ```powershell
   npm run dist:portable
   ```

4. Or build both Windows deliverables together:

   ```powershell
   npm run dist:win:all
   ```

## Installation (End Users on Windows 10 / 11)

- **Installer (`Helal-Video-Converter-Setup.exe`)**: Run the setup wizard, choose your install folder and optional Desktop/Start Menu shortcuts, and launch **Helal Video Converter**. Supports standard Windows **Add or Remove Programs** uninstallation.
- **Portable (`Helal-Video-Converter-Portable.exe`)**: Run directly from any folder or USB drive without installation.

## Licensing

Application source code licensing and third-party FFmpeg binary redistribution requirements are documented in [electron/resources/FFMPEG_LICENSE.md](./electron/resources/FFMPEG_LICENSE.md).
