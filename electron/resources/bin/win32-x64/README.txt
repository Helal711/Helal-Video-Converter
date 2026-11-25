# Windows x64 Bundled Binaries Directory

Place verified Windows x64 `ffmpeg.exe` and `ffprobe.exe` binaries in this directory before building the Windows installer or portable executable.

You can populate this directory automatically on Windows (or in CI) by running:

```bash
npm run fetch:ffmpeg:win
```

When packaged with `electron-builder`, these binaries are copied into `<install-dir>/resources/bin/win32-x64/` and resolved offline by `electron/services/binaryManager.ts`.
