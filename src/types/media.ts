export type ThemeMode = 'dark' | 'light';

export type AppModuleId =
  | 'dashboard'
  | 'video-converter'
  | 'video-compressor'
  | 'audio-converter'
  | 'video-trimmer'
  | 'video-resizer'
  | 'video-to-gif'
  | 'batch-converter'
  | 'history'
  | 'settings';

export type ModuleReadiness = 'implemented' | 'staged' | 'awaiting-backend';

export interface ModuleDefinition {
  id: AppModuleId;
  label: string;
  shortDescription: string;
  readiness: ModuleReadiness;
  readinessLabel: string;
  targetPipeline: string;
  plannedCapabilities: string[];
}

export type MediaKind = 'video' | 'audio' | 'unknown';

export interface MediaMetadata {
  containerFormat: string | null;
  durationSeconds: number | null;
  sizeBytes?: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  frameRate: number | null;
  bitrateKbps: number | null;
  audioChannels: number | null;
  audioChannelLayout: string | null;
  metadataSource: 'html5-local' | 'ffprobe' | 'file-header-only';
}

export type VideoContainer = 'mp4' | 'mkv' | 'avi' | 'mov' | 'webm';
export type VideoCodecOption = 'h264' | 'h265' | 'vp9';
export type AudioCodecOption = 'aac' | 'mp3' | 'flac' | 'opus';
export type ResolutionPreset = 'original' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
export type QualityPreset = 'low' | 'medium' | 'high' | 'custom';
export type EncoderSpeed = 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow';

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

export interface QueueItemProgress {
  percent: number | null;
  elapsedSeconds: number;
  etaSeconds: number | null;
  speed: string | null;
  outputSizeBytes: number | null;
  outTimeSeconds: number;
  currentStage: string;
}

export type QueueItemStatus =
  | 'queued'
  | 'awaiting-desktop-runtime'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface ConversionPreset {
  id: string;
  name: string;
  category: 'video' | 'audio' | 'archive';
  container: string;
  videoCodec: string;
  audioCodec: string;
  crf?: number;
  audioBitrate?: string;
  description: string;
  ffmpegArgs: string[];
  videoConfig?: VideoConversionConfig;
}

export interface QueueItem {
  id: string;
  fileName: string;
  extension: string;
  filePath: string | null; // Available in Electron desktop runtime; null in browser sandbox
  sizeBytes: number;
  mimeType: string;
  kind: MediaKind;
  addedAt: string;
  presetId: string;
  conversionConfig: VideoConversionConfig;
  targetModule: AppModuleId;
  status: QueueItemStatus;
  statusDetail: string;
  progress: QueueItemProgress | null;
  outputPath: string | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  metadata: MediaMetadata;
}

export interface HistoryEntry {
  id: string;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  presetName: string;
  inputSizeBytes: number;
  outputSizeBytes: number | null;
  outputPath: string;
  completedAt: string;
  elapsedSeconds?: number | null;
  status: 'completed' | 'failed' | 'cancelled';
}

export type HardwareAcceleration = 'auto' | 'nvenc' | 'qsv' | 'amf' | 'cpu';

export type ExistingFilePolicy = 'rename' | 'overwrite' | 'skip';

export interface AppSettings {
  theme: ThemeMode;
  defaultOutputDirectory: string;
  ffmpegBinaryPath: string;
  ffprobeBinaryPath: string;
  hardwareAcceleration: HardwareAcceleration;
  maxConcurrentJobs: number;
  existingFilePolicy: ExistingFilePolicy;
  preserveMetadata: boolean;
  openOutputFolderOnComplete: boolean;
}

export type BinarySource = 'configured' | 'bundled' | 'system-path' | 'missing';

export interface RuntimeCapabilities {
  environment: 'electron-desktop' | 'browser-preview';
  platform: string;
  contextIsolation: boolean;
  nodeIntegration: boolean;
  sandbox?: boolean;
  ffmpegDetected: boolean;
  ffprobeDetected: boolean;
  ffmpegVersion: string | null;
  ffprobeVersion: string | null;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  ffmpegSource: BinarySource;
  ffprobeSource: BinarySource;
  binaryWarnings: string[];
}
