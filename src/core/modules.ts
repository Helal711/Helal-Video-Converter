import type { ModuleDefinition } from '../types/media';

export const APP_MODULES: ModuleDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortDescription: 'Media intake, queue staging, and local runtime diagnostics.',
    readiness: 'implemented',
    readinessLabel: 'Implemented',
    targetPipeline: 'Electron IPC Bridge + Local File Inspector',
    plannedCapabilities: [
      'Drag-and-drop and local file picker intake',
      'Client-side media metadata inspection (size, duration, resolution)',
      'Unified conversion queue staging and preset assignment',
      'Live Electron & FFmpeg/FFprobe environment detection',
    ],
  },
  {
    id: 'video-converter',
    label: 'Video Converter',
    shortDescription: 'Container and codec transcoding across MP4, MKV, AVI, MOV, and WebM.',
    readiness: 'implemented',
    readinessLabel: 'Implemented',
    targetPipeline: 'ffmpeg -i input -c:v libx264/libx265/libvpx-vp9 -c:a aac/mp3/flac',
    plannedCapabilities: [
      'Container transcoding across MP4, MKV, AVI, MOV, and WebM',
      'Video codecs (H.264, H.265/HEVC, VP9) & Audio codecs (AAC, MP3, FLAC)',
      'Resolution scaling (Original, 480p, 720p, 1080p, 1440p, 2160p) & Quality presets',
      'Real-time FFmpeg progress, ETA, and output size tracking via Electron IPC',
    ],
  },
  {
    id: 'video-compressor',
    label: 'Video Compressor',
    shortDescription: 'Target file size or CRF bitrate optimization for storage and sharing.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'ffmpeg 2-pass VBR / CRF bitrate control',
    plannedCapabilities: [
      'Target output size calculator based on FFprobe duration',
      'Two-pass H.264 / H.265 encoding for predictable file sizes',
      'Resolution downscaling toggle for bandwidth savings',
    ],
  },
  {
    id: 'audio-converter',
    label: 'Audio Converter',
    shortDescription: 'Extract audio tracks or transcode between MP3, AAC, FLAC, and WAV.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'ffmpeg -vn -c:a libmp3lame / flac / aac',
    plannedCapabilities: [
      'Strip video streams to extract lossless or compressed audio',
      'Bitrate, sample rate (44.1 / 48 kHz), and channel selection',
      'ID3 / container metadata preservation',
    ],
  },
  {
    id: 'video-trimmer',
    label: 'Video Trimmer',
    shortDescription: 'Frame-accurate or lossless keyframe-aligned start and end cutting.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'ffmpeg -ss <start> -to <end> -c copy / re-encode',
    plannedCapabilities: [
      'Timeline range selection with millisecond precision',
      'Fast lossless stream copy mode without re-encoding',
      'Frame-accurate re-encode mode when cutting between keyframes',
    ],
  },
  {
    id: 'video-resizer',
    label: 'Video Resizer',
    shortDescription: 'Scale video dimensions to 4K, 1440p, 1080p, 720p, or custom bounds.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'ffmpeg -vf scale=w:h:flags=lanczos',
    plannedCapabilities: [
      'Aspect-ratio-locked preset resolutions and custom dimensions',
      'Lanczos and bicubic scaling filter selection',
      'Even-dimension enforcement for hardware encoder compatibility',
    ],
  },
  {
    id: 'video-to-gif',
    label: 'Video to GIF',
    shortDescription: 'High-fidelity animated GIF export using two-pass palette generation.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'ffmpeg palettegen + paletteuse filtergraph',
    plannedCapabilities: [
      'Custom FPS (10–30 fps) and output width controls',
      'Two-pass palettegen/paletteuse for clean color gradients',
      'Loop count and clip range selection',
    ],
  },
  {
    id: 'batch-converter',
    label: 'Batch Converter',
    shortDescription: 'Parallel multi-file queue orchestration with shared encoding profiles.',
    readiness: 'awaiting-backend',
    readinessLabel: 'Awaiting Backend',
    targetPipeline: 'Controlled worker pool spawning FFmpeg child processes',
    plannedCapabilities: [
      'Apply one encoding profile across entire folders of media',
      'Configurable worker concurrency limit from Settings',
      'Per-job cancellation and failure isolation',
    ],
  },
  {
    id: 'history',
    label: 'Conversion History',
    shortDescription: 'Persistent local ledger of completed, failed, and cancelled jobs.',
    readiness: 'implemented',
    readinessLabel: 'Implemented',
    targetPipeline: 'Local JSON / Indexed Storage Ledger',
    plannedCapabilities: [
      'Searchable record of completed local conversions',
      'Input vs output size comparison and duration tracking',
      'Quick reveal-in-folder action when running in Electron',
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    shortDescription: 'Theme, output directory, FFmpeg/FFprobe paths, and hardware acceleration.',
    readiness: 'implemented',
    readinessLabel: 'Implemented',
    targetPipeline: 'Electron userData JSON + Browser localStorage sync',
    plannedCapabilities: [
      'Dark and Light desktop theme persistence',
      'Custom FFmpeg.exe and FFprobe.exe executable paths',
      'Hardware encoder preference (NVENC, QuickSync, AMF, CPU)',
    ],
  },
];

export function getModuleById(id: string): ModuleDefinition {
  return APP_MODULES.find((m) => m.id === id) ?? APP_MODULES[0];
}
