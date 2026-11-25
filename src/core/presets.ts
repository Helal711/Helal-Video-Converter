import type { ConversionPreset, VideoConversionConfig } from '../types/media';
import { buildConversionCliPreviewArgs } from './conversionConfig';

export const CONVERSION_PRESETS: ConversionPreset[] = [
  {
    id: 'mp4-h264-balanced',
    name: 'MP4 · H.264 Balanced',
    category: 'video',
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 22,
    audioBitrate: '192k',
    description: 'Universal compatibility for Windows, web players, and mobile devices.',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
    videoConfig: {
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      resolution: 'original',
      qualityPreset: 'medium',
      customCrf: 22,
      customAudioBitrateKbps: 192,
      encoderSpeed: 'medium',
    },
  },
  {
    id: 'mp4-h265-compact',
    name: 'MP4 · H.265 (HEVC)',
    category: 'video',
    container: 'mp4',
    videoCodec: 'libx265',
    audioCodec: 'aac',
    crf: 24,
    audioBitrate: '192k',
    description: 'Higher compression efficiency for 1080p and 4K footage at smaller file sizes.',
    ffmpegArgs: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '24', '-tag:v', 'hvc1', '-c:a', 'aac', '-b:a', '192k'],
    videoConfig: {
      container: 'mp4',
      videoCodec: 'h265',
      audioCodec: 'aac',
      resolution: 'original',
      qualityPreset: 'medium',
      customCrf: 24,
      customAudioBitrateKbps: 192,
      encoderSpeed: 'medium',
    },
  },
  {
    id: 'mkv-h264-high',
    name: 'MKV · H.264 High Quality',
    category: 'video',
    container: 'mkv',
    videoCodec: 'libx264',
    audioCodec: 'flac',
    crf: 18,
    description: 'High-fidelity Matroska container with lossless FLAC audio.',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'flac'],
    videoConfig: {
      container: 'mkv',
      videoCodec: 'h264',
      audioCodec: 'flac',
      resolution: 'original',
      qualityPreset: 'high',
      customCrf: 18,
      customAudioBitrateKbps: 256,
      encoderSpeed: 'slow',
    },
  },
  {
    id: 'mov-h264-edit',
    name: 'MOV · H.264 + AAC',
    category: 'video',
    container: 'mov',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 18,
    audioBitrate: '256k',
    description: 'QuickTime-compatible MOV container suited for editing and macOS/Windows playback.',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart'],
    videoConfig: {
      container: 'mov',
      videoCodec: 'h264',
      audioCodec: 'aac',
      resolution: 'original',
      qualityPreset: 'high',
      customCrf: 18,
      customAudioBitrateKbps: 256,
      encoderSpeed: 'slow',
    },
  },
  {
    id: 'avi-h264-legacy',
    name: 'AVI · H.264 + MP3',
    category: 'video',
    container: 'avi',
    videoCodec: 'libx264',
    audioCodec: 'libmp3lame',
    crf: 22,
    audioBitrate: '192k',
    description: 'Classic AVI container with H.264 video and MP3 audio.',
    ffmpegArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-c:a', 'libmp3lame', '-b:a', '192k'],
    videoConfig: {
      container: 'avi',
      videoCodec: 'h264',
      audioCodec: 'mp3',
      resolution: 'original',
      qualityPreset: 'medium',
      customCrf: 22,
      customAudioBitrateKbps: 192,
      encoderSpeed: 'medium',
    },
  },
  {
    id: 'webm-vp9-web',
    name: 'WebM · VP9 + Opus',
    category: 'video',
    container: 'webm',
    videoCodec: 'libvpx-vp9',
    audioCodec: 'libopus',
    crf: 30,
    audioBitrate: '192k',
    description: 'Open web-standard video encoding optimized for browser playback.',
    ffmpegArgs: ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', '-b:a', '192k'],
    videoConfig: {
      container: 'webm',
      videoCodec: 'vp9',
      audioCodec: 'opus',
      resolution: 'original',
      qualityPreset: 'medium',
      customCrf: 30,
      customAudioBitrateKbps: 192,
      encoderSpeed: 'medium',
    },
  },
];

export function getPresetById(id: string): ConversionPreset {
  return CONVERSION_PRESETS.find((p) => p.id === id) ?? CONVERSION_PRESETS[0];
}

export function buildFfmpegCommandPreview(
  inputFileName: string,
  config: VideoConversionConfig,
  outputDir: string,
  preserveMetadata = true,
): string {
  const dotIndex = inputFileName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? inputFileName.slice(0, dotIndex) : inputFileName;
  const separator = outputDir.includes('\\') ? '\\' : '/';
  const cleanDir = outputDir.replace(/[\\/]+$/, '');
  const outputPath = cleanDir
    ? `${cleanDir}${separator}${baseName}.${config.container}`
    : `${baseName}.${config.container}`;

  const args = buildConversionCliPreviewArgs(config, preserveMetadata);
  return `ffmpeg -i "${inputFileName}" ${args.join(' ')} "${outputPath}"`;
}
