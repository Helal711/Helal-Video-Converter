import type {
  AudioCodecOption,
  EncoderSpeed,
  QualityPreset,
  ResolutionPreset,
  VideoCodecOption,
  VideoContainer,
  VideoConversionConfig,
} from '../types/media';

export const DEFAULT_VIDEO_CONVERSION_CONFIG: VideoConversionConfig = {
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  resolution: 'original',
  qualityPreset: 'medium',
  customCrf: 22,
  customAudioBitrateKbps: 192,
  encoderSpeed: 'medium',
};

export const CONTAINER_OPTIONS: { value: VideoContainer; label: string }[] = [
  { value: 'mp4', label: 'MP4 (.mp4)' },
  { value: 'mkv', label: 'MKV (.mkv)' },
  { value: 'mov', label: 'MOV (.mov)' },
  { value: 'avi', label: 'AVI (.avi)' },
  { value: 'webm', label: 'WebM (.webm)' },
];

export const VIDEO_CODEC_OPTIONS: { value: VideoCodecOption; label: string }[] = [
  { value: 'h264', label: 'H.264 (AVC)' },
  { value: 'h265', label: 'H.265 (HEVC)' },
  { value: 'vp9', label: 'VP9' },
];

export const AUDIO_CODEC_OPTIONS: { value: AudioCodecOption; label: string }[] = [
  { value: 'aac', label: 'AAC' },
  { value: 'mp3', label: 'MP3' },
  { value: 'flac', label: 'FLAC (Lossless)' },
  { value: 'opus', label: 'Opus (WebM Standard)' },
];

export const RESOLUTION_OPTIONS: { value: ResolutionPreset; label: string; height: number | null }[] = [
  { value: 'original', label: 'Original', height: null },
  { value: '480p', label: '480p (SD)', height: 480 },
  { value: '720p', label: '720p (HD)', height: 720 },
  { value: '1080p', label: '1080p (Full HD)', height: 1080 },
  { value: '1440p', label: '1440p (2K QHD)', height: 1440 },
  { value: '2160p', label: '2160p (4K UHD)', height: 2160 },
];

export const QUALITY_OPTIONS: { value: QualityPreset; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Smaller output file, faster encode' },
  { value: 'medium', label: 'Medium', description: 'Balanced quality and file size' },
  { value: 'high', label: 'High', description: 'High visual fidelity' },
  { value: 'custom', label: 'Custom', description: 'Manual CRF, bitrate, and speed' },
];

export const ENCODER_SPEED_OPTIONS: EncoderSpeed[] = [
  'ultrafast',
  'veryfast',
  'fast',
  'medium',
  'slow',
];

const CONTAINER_VIDEO_ALLOWLIST: Record<VideoContainer, VideoCodecOption[]> = {
  mp4: ['h264', 'h265'],
  mkv: ['h264', 'h265', 'vp9'],
  mov: ['h264', 'h265'],
  avi: ['h264'],
  webm: ['vp9'],
};

const CONTAINER_AUDIO_ALLOWLIST: Record<VideoContainer, AudioCodecOption[]> = {
  mp4: ['aac', 'mp3'],
  mkv: ['aac', 'mp3', 'flac', 'opus'],
  mov: ['aac', 'mp3', 'flac'],
  avi: ['mp3', 'aac'],
  webm: ['opus'],
};

export function getAllowedVideoCodecs(container: VideoContainer): VideoCodecOption[] {
  return CONTAINER_VIDEO_ALLOWLIST[container];
}

export function getAllowedAudioCodecs(container: VideoContainer): AudioCodecOption[] {
  return CONTAINER_AUDIO_ALLOWLIST[container];
}

export function normalizeConfigForContainer(
  config: VideoConversionConfig,
): VideoConversionConfig {
  const allowedVideo = getAllowedVideoCodecs(config.container);
  const allowedAudio = getAllowedAudioCodecs(config.container);

  return {
    ...config,
    videoCodec: allowedVideo.includes(config.videoCodec)
      ? config.videoCodec
      : allowedVideo[0],
    audioCodec: allowedAudio.includes(config.audioCodec)
      ? config.audioCodec
      : allowedAudio[0],
  };
}

export function validateConversionCompatibility(
  config: VideoConversionConfig,
): string | null {
  const allowedVideo = getAllowedVideoCodecs(config.container);
  if (!allowedVideo.includes(config.videoCodec)) {
    return `${config.container.toUpperCase()} container does not support ${config.videoCodec.toUpperCase()} in this pipeline. Supported video codecs: ${allowedVideo.join(', ').toUpperCase()}.`;
  }
  const allowedAudio = getAllowedAudioCodecs(config.container);
  if (!allowedAudio.includes(config.audioCodec)) {
    return `${config.container.toUpperCase()} container does not support ${config.audioCodec.toUpperCase()} in this pipeline. Supported audio codecs: ${allowedAudio.join(', ').toUpperCase()}.`;
  }
  return null;
}

export function buildConversionCliPreviewArgs(
  config: VideoConversionConfig,
  preserveMetadata = true,
): string[] {
  const args: string[] = [];

  // Video codec & quality
  if (config.videoCodec === 'h264') {
    const crf =
      config.qualityPreset === 'low'
        ? 28
        : config.qualityPreset === 'medium'
          ? 22
          : config.qualityPreset === 'high'
            ? 18
            : Math.min(51, Math.max(0, Math.round(config.customCrf)));
    const preset =
      config.qualityPreset === 'low'
        ? 'veryfast'
        : config.qualityPreset === 'high'
          ? 'slow'
          : config.qualityPreset === 'custom'
            ? config.encoderSpeed
            : 'medium';
    args.push('-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p');
  } else if (config.videoCodec === 'h265') {
    const crf =
      config.qualityPreset === 'low'
        ? 30
        : config.qualityPreset === 'medium'
          ? 24
          : config.qualityPreset === 'high'
            ? 20
            : Math.min(51, Math.max(0, Math.round(config.customCrf)));
    const preset =
      config.qualityPreset === 'low'
        ? 'veryfast'
        : config.qualityPreset === 'high'
          ? 'slow'
          : config.qualityPreset === 'custom'
            ? config.encoderSpeed
            : 'medium';
    args.push('-c:v', 'libx265', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p');
    if (config.container === 'mp4' || config.container === 'mov') {
      args.push('-tag:v', 'hvc1');
    }
  } else if (config.videoCodec === 'vp9') {
    const crf =
      config.qualityPreset === 'low'
        ? 36
        : config.qualityPreset === 'medium'
          ? 30
          : config.qualityPreset === 'high'
            ? 24
            : Math.min(63, Math.max(4, Math.round(config.customCrf)));
    args.push('-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-deadline', 'good', '-cpu-used', '2');
  }

  // Resolution scaling
  const resInfo = RESOLUTION_OPTIONS.find((r) => r.value === config.resolution);
  if (resInfo && resInfo.height !== null) {
    args.push('-vf', `scale=-2:${resInfo.height}:flags=lanczos`);
  }

  // Audio codec & bitrate
  const audioBitrate =
    config.qualityPreset === 'low'
      ? 128
      : config.qualityPreset === 'medium'
        ? 192
        : config.qualityPreset === 'high'
          ? 256
          : Math.min(320, Math.max(64, Math.round(config.customAudioBitrateKbps)));

  if (config.audioCodec === 'aac') {
    args.push('-c:a', 'aac', '-b:a', `${audioBitrate}k`);
  } else if (config.audioCodec === 'mp3') {
    args.push('-c:a', 'libmp3lame', '-b:a', `${audioBitrate}k`);
  } else if (config.audioCodec === 'flac') {
    args.push('-c:a', 'flac');
  } else if (config.audioCodec === 'opus') {
    args.push('-c:a', 'libopus', '-b:a', `${Math.min(audioBitrate, 256)}k`);
  }

  if (config.container === 'mp4' || config.container === 'mov') {
    args.push('-movflags', '+faststart');
  }

  args.push('-map_metadata', preserveMetadata ? '0' : '-1');

  return args;
}
