import type {
  AppSettings,
  ExistingFilePolicy,
  HardwareAcceleration,
  MediaMetadata,
  QueueItemProgress,
  QueueItemStatus,
  RuntimeCapabilities,
  VideoConversionConfig,
} from './media';

export interface ElectronFileSelection {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  extension: string;
}

export interface ElectronQueueJobInput {
  jobId: string;
  inputPath: string;
  fileName: string;
  config: VideoConversionConfig;
  durationSeconds: number | null;
}

export interface ElectronQueueStartRequest {
  jobs: ElectronQueueJobInput[];
  outputDirectory: string;
  ffmpegBinaryPath: string;
  ffprobeBinaryPath: string;
  hardwareAcceleration: HardwareAcceleration;
  maxConcurrentJobs: number;
  existingFilePolicy: ExistingFilePolicy;
  preserveMetadata: boolean;
  openOutputFolderOnComplete: boolean;
}

export interface ElectronQueueProgressEvent {
  jobId: string;
  progress: QueueItemProgress;
}

export interface ElectronQueueStatusEvent {
  jobId: string;
  status: QueueItemStatus;
  statusDetail: string;
  outputPath: string | null;
  outputSizeBytes: number | null;
  elapsedSeconds: number | null;
  errorMessage: string | null;
}

export interface ElectronQueueStartResult {
  started: boolean;
  error?: string;
}

export interface HelalElectronAPI {
  getRuntimeCapabilities: (overrides?: {
    ffmpegBinaryPath?: string;
    ffprobeBinaryPath?: string;
  }) => Promise<RuntimeCapabilities>;
  selectMediaFiles: () => Promise<ElectronFileSelection[]>;
  selectOutputDirectory: () => Promise<string | null>;
  getPathForFile: (file: File) => string | null;
  probeMediaFile: (
    filePath: string,
    ffprobeBinaryPath?: string,
  ) => Promise<MediaMetadata>;
  startQueue: (request: ElectronQueueStartRequest) => Promise<ElectronQueueStartResult>;
  cancelQueueJob: (jobId: string) => Promise<boolean>;
  cancelAllQueueJobs: () => Promise<number>;
  openPathInExplorer: (targetPath: string) => Promise<void>;
  revealFileInExplorer: (targetPath: string) => Promise<void>;
  loadSettings: () => Promise<Partial<AppSettings> | null>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  onQueueProgress: (
    callback: (event: ElectronQueueProgressEvent) => void,
  ) => () => void;
  onQueueStatus: (
    callback: (event: ElectronQueueStatusEvent) => void,
  ) => () => void;
}

declare global {
  interface Window {
    electronAPI?: HelalElectronAPI;
  }
}

export {};
