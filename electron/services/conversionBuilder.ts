export type VideoContainer = 'mp4' | 'mkv' | 'avi' | 'mov' | 'webm';
export type VideoCodecOption = 'h264' | 'h265' | 'vp9';
export type AudioCodecOption = 'aac' | 'mp3' | 'flac' | 'opus';
export type ResolutionPreset = 'original' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
export type QualityPreset = 'low' | 'medium' | 'high' | 'custom';
export type EncoderSpeed = 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow';
export type HardwareAcceleration = 'auto' | 'nvenc' | 'qsv' | 'amf' | 'cpu';

export interface VideoConversionConfig {
  container: VideoContainer;
  videoCodec: VideoCodecOption;
  audioCodec: AudioCodecOption;
  resolution: ResolutionPreset;
  qualityPreset: QualityPreset;
  customCrf: number;
  customAudioBitrateKbps: number;
  encoderSpeed: EncoderSpeed;
}

const VALID_CONTAINERS = new Set<VideoContainer>(['mp4', 'mkv', 'avi', 'mov', 'webm']);
const VALID_VIDEO_CODECS = new Set<VideoCodecOption>(['h264', 'h265', 'vp9']);
const VALID_AUDIO_CODECS = new Set<AudioCodecOption>(['aac', 'mp3', 'flac', 'opus']);
const VALID_RESOLUTIONS = new Map<ResolutionPreset, number | null>([
  ['original', null],
  ['480p', 480],
  ['720p', 720],
  ['1080p', 1080],
  ['1440p', 1440],
  ['2160p', 2160],
]);
const VALID_QUALITY = new Set<QualityPreset>(['low', 'medium', 'high', 'custom']);
const VALID_SPEEDS = new Set<EncoderSpeed>(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']);

const CONTAINER_VIDEO_COMPAT: Record<VideoContainer, Set<VideoCodecOption>> = {
  mp4: new Set(['h264', 'h265']),
  mkv: new Set(['h264', 'h265', 'vp9']),
  mov: new Set(['h264', 'h265']),
  avi: new Set(['h264']),
  webm: new Set(['vp9']),
};

const CONTAINER_AUDIO_COMPAT: Record<VideoContainer, Set<AudioCodecOption>> = {
  mp4: new Set(['aac', 'mp3']),
  mkv: new Set(['aac', 'mp3', 'flac', 'opus']),
  mov: new Set(['aac', 'mp3', 'flac']),
  avi: new Set(['mp3', 'aac']),
  webm: new Set(['opus']),
};

export function validateConversionConfig(raw: unknown): VideoConversionConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Conversion configuration object is missing.');
  }

  const candidate = raw as Partial<VideoConversionConfig>;

  if (!candidate.container || !VALID_CONTAINERS.has(candidate.container)) {
    throw new Error(`Invalid container format: ${String(candidate.container)}`);
  }
  if (!candidate.videoCodec || !VALID_VIDEO_CODECS.has(candidate.videoCodec)) {
    throw new Error(`Invalid video codec: ${String(candidate.videoCodec)}`);
  }
  if (!candidate.audioCodec || !VALID_AUDIO_CODECS.has(candidate.audioCodec)) {
    throw new Error(`Invalid audio codec: ${String(candidate.audioCodec)}`);
  }
  if (!candidate.resolution || !VALID_RESOLUTIONS.has(candidate.resolution)) {
    throw new Error(`Invalid resolution preset: ${String(candidate.resolution)}`);
  }
  if (!candidate.qualityPreset || !VALID_QUALITY.has(candidate.qualityPreset)) {
    throw new Error(`Invalid quality preset: ${String(candidate.qualityPreset)}`);
  }

  if (!CONTAINER_VIDEO_COMPAT[candidate.container].has(candidate.videoCodec)) {
    throw new Error(
      `Container ${candidate.container.toUpperCase()} does not support video codec ${candidate.videoCodec.toUpperCase()}.`,
    );
  }
  if (!CONTAINER_AUDIO_COMPAT[candidate.container].has(candidate.audioCodec)) {
    throw new Error(
      `Container ${candidate.container.toUpperCase()} does not support audio codec ${candidate.audioCodec.toUpperCase()}.`,
    );
  }

  const customCrf = Number.isFinite(Number(candidate.customCrf))
    ? Math.min(63, Math.max(0, Math.round(Number(candidate.customCrf))))
    : 22;

  const customAudioBitrateKbps = Number.isFinite(Number(candidate.customAudioBitrateKbps))
    ? Math.min(320, Math.max(64, Math.round(Number(candidate.customAudioBitrateKbps))))
    : 192;

  const encoderSpeed: EncoderSpeed =
    candidate.encoderSpeed && VALID_SPEEDS.has(candidate.encoderSpeed)
      ? candidate.encoderSpeed
      : 'medium';

  return {
    container: candidate.container,
    videoCodec: candidate.videoCodec,
    audioCodec: candidate.audioCodec,
    resolution: candidate.resolution,
    qualityPreset: candidate.qualityPreset,
    customCrf,
    customAudioBitrateKbps,
    encoderSpeed,
  };
}

export function buildValidatedFfmpegArgs(
  config: VideoConversionConfig,
  options: {
    preserveMetadata: boolean;
    hardwareAcceleration: HardwareAcceleration;
    hasAudioStream: boolean;
  },
): string[] {
  const args: string[] = [];

  // Map video stream safely
  args.push('-map', '0:v:0');
  if (options.hasAudioStream) {
    args.push('-map', '0:a:0?');
  }

  // Video encoder selection
  if (config.videoCodec === 'h264') {
    const crf =
      config.qualityPreset === 'low'
        ? 28
        : config.qualityPreset === 'medium'
          ? 22
          : config.qualityPreset === 'high'
            ? 18
            : Math.min(51, config.customCrf);

    const speed =
      config.qualityPreset === 'low'
        ? 'veryfast'
        : config.qualityPreset === 'high'
          ? 'slow'
          : config.qualityPreset === 'custom'
            ? config.encoderSpeed
            : 'medium';

    if (options.hardwareAcceleration === 'nvenc') {
      args.push('-c:v', 'h264_nvenc', '-cq', String(crf), '-pix_fmt', 'yuv420p');
    } else if (options.hardwareAcceleration === 'qsv') {
      args.push('-c:v', 'h264_qsv', '-global_quality', String(crf), '-pix_fmt', 'nv12');
    } else if (options.hardwareAcceleration === 'amf') {
      args.push('-c:v', 'h264_amf', '-qp_i', String(crf), '-qp_p', String(crf));
    } else {
      args.push('-c:v', 'libx264', '-preset', speed, '-crf', String(crf), '-pix_fmt', 'yuv420p');
    }
  } else if (config.videoCodec === 'h265') {
    const crf =
      config.qualityPreset === 'low'
        ? 30
        : config.qualityPreset === 'medium'
          ? 24
          : config.qualityPreset === 'high'
            ? 20
            : Math.min(51, config.customCrf);

    const speed =
      config.qualityPreset === 'low'
        ? 'veryfast'
        : config.qualityPreset === 'high'
          ? 'slow'
          : config.qualityPreset === 'custom'
            ? config.encoderSpeed
            : 'medium';

    if (options.hardwareAcceleration === 'nvenc') {
      args.push('-c:v', 'hevc_nvenc', '-cq', String(crf), '-pix_fmt', 'yuv420p');
    } else if (options.hardwareAcceleration === 'qsv') {
      args.push('-c:v', 'hevc_qsv', '-global_quality', String(crf));
    } else if (options.hardwareAcceleration === 'amf') {
      args.push('-c:v', 'hevc_amf', '-qp_i', String(crf), '-qp_p', String(crf));
    } else {
      args.push('-c:v', 'libx265', '-preset', speed, '-crf', String(crf), '-pix_fmt', 'yuv420p');
    }

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
            : Math.min(63, Math.max(4, config.customCrf));

    args.push(
      '-c:v',
      'libvpx-vp9',
      '-crf',
      String(crf),
      '-b:v',
      '0',
      '-deadline',
      'good',
      '-cpu-used',
      config.qualityPreset === 'high' ? '1' : '2',
      '-pix_fmt',
      'yuv420p',
    );
  }

  // Resolution scaling
  const targetHeight = VALID_RESOLUTIONS.get(config.resolution) ?? null;
  if (targetHeight !== null) {
    args.push('-vf', `scale=-2:${targetHeight}:flags=lanczos`);
  }

  // Audio codec & bitrate
  if (options.hasAudioStream) {
    const audioBitrate =
      config.qualityPreset === 'low'
        ? 128
        : config.qualityPreset === 'medium'
          ? 192
          : config.qualityPreset === 'high'
            ? 256
            : config.customAudioBitrateKbps;

    if (config.audioCodec === 'aac') {
      args.push('-c:a', 'aac', '-b:a', `${audioBitrate}k`);
    } else if (config.audioCodec === 'mp3') {
      args.push('-c:a', 'libmp3lame', '-b:a', `${audioBitrate}k`);
    } else if (config.audioCodec === 'flac') {
      args.push('-c:a', 'flac');
    } else if (config.audioCodec === 'opus') {
      args.push('-c:a', 'libopus', '-b:a', `${Math.min(audioBitrate, 256)}k`);
    }
  } else {
    args.push('-an');
  }

  if (config.container === 'mp4' || config.container === 'mov') {
    args.push('-movflags', '+faststart');
  }

  args.push('-map_metadata', options.preserveMetadata ? '0' : '-1');

  return args;
}
