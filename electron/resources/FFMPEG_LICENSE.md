# FFmpeg & FFprobe Binary Redistribution Notice

Helal Video Converter invokes external `ffmpeg` and `ffprobe` executables locally via `child_process.spawn` without cloud processing or paid APIs.

## Licensing & Redistribution Review
- **LGPL v2.1+ Builds**: Standard LGPL FFmpeg builds (without `--enable-gpl` / `libx264` / `libx265`) may be bundled alongside proprietary or permissive applications provided LGPL notices and dynamic-linking/replacement compliance are preserved.
- **GPL v2 / GPL v3 Builds**: Builds compiled with `--enable-gpl` (which include `libx264` and `libx265` software encoders) fall under the GNU General Public License (GPL). If you distribute bundled GPL FFmpeg binaries inside a Windows installer, your distribution must comply with GPL terms (including providing license text and corresponding FFmpeg source availability notice).
- **Recommended Packaging Layout (Windows x64)**:
  Place verified `ffmpeg.exe` and `ffprobe.exe` binaries in:
  `resources/bin/win32-x64/ffmpeg.exe`
  `resources/bin/win32-x64/ffprobe.exe`
  and include the corresponding `LICENSE.txt` / source notice alongside them.
