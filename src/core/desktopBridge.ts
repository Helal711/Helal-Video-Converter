import type {
  AppSettings,
  MediaMetadata,
  RuntimeCapabilities,
} from '../types/media';
import type {
  ElectronFileSelection,
  ElectronQueueProgressEvent,
  ElectronQueueStartRequest,
  ElectronQueueStartResult,
  ElectronQueueStatusEvent,
} from '../types/electron';

export const BROWSER_FALLBACK_CAPABILITIES: RuntimeCapabilities = {
  environment: 'browser-preview',
  platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Web',
  contextIsolation: false,
  nodeIntegration: false,
  sandbox: false,
  ffmpegDetected: false,
  ffprobeDetected: false,
  ffmpegVersion: null,
  ffprobeVersion: null,
  ffmpegPath: null,
  ffprobePath: null,
  ffmpegSource: 'missing',
  ffprobeSource: 'missing',
  binaryWarnings: [
    'Running in Browser Preview mode. Launch via Electron on Windows to access local FFmpeg and FFprobe binaries.',
  ],
};

export function isElectronRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

export async function fetchRuntimeCapabilities(overrides?: {
  ffmpegBinaryPath?: string;
  ffprobeBinaryPath?: string;
}): Promise<RuntimeCapabilities> {
  if (isElectronRuntime() && window.electronAPI) {
    try {
      return await window.electronAPI.getRuntimeCapabilities(overrides);
    } catch {
      return BROWSER_FALLBACK_CAPABILITIES;
    }
  }
  return BROWSER_FALLBACK_CAPABILITIES;
}

export function getDroppedFilePath(file: File): string | null {
  if (isElectronRuntime() && window.electronAPI?.getPathForFile) {
    try {
      return window.electronAPI.getPathForFile(file);
    } catch {
      // Fallback below
    }
  }
  return (file as File & { path?: string }).path ?? null;
}

export async function openDesktopFileDialog(): Promise<ElectronFileSelection[] | null> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.selectMediaFiles();
  }
  return null;
}

export async function openDesktopDirectoryDialog(): Promise<string | null> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.selectOutputDirectory();
  }
  return null;
}

export async function probeViaDesktopRuntime(
  filePath: string,
  ffprobeBinaryPath?: string,
): Promise<MediaMetadata | null> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.probeMediaFile(filePath, ffprobeBinaryPath);
  }
  return null;
}

export async function startDesktopQueue(
  request: ElectronQueueStartRequest,
): Promise<ElectronQueueStartResult> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.startQueue(request);
  }
  return {
    started: false,
    error: 'Electron IPC bridge is unavailable in Browser Preview mode.',
  };
}

export async function cancelDesktopJob(jobId: string): Promise<boolean> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.cancelQueueJob(jobId);
  }
  return false;
}

export async function cancelAllDesktopJobs(): Promise<number> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.cancelAllQueueJobs();
  }
  return 0;
}

export async function revealDesktopFile(targetPath: string): Promise<void> {
  if (isElectronRuntime() && window.electronAPI) {
    await window.electronAPI.revealFileInExplorer(targetPath);
  }
}

export async function loadSettingsFromDesktop(): Promise<Partial<AppSettings> | null> {
  if (isElectronRuntime() && window.electronAPI) {
    return window.electronAPI.loadSettings();
  }
  return null;
}

export async function persistSettingsToDesktop(settings: AppSettings): Promise<void> {
  if (isElectronRuntime() && window.electronAPI) {
    await window.electronAPI.saveSettings(settings);
  }
}

export function subscribeDesktopQueueEvents(handlers: {
  onProgress: (event: ElectronQueueProgressEvent) => void;
  onStatus: (event: ElectronQueueStatusEvent) => void;
}): () => void {
  if (!isElectronRuntime() || !window.electronAPI) {
    return () => {};
  }
  const unsubProgress = window.electronAPI.onQueueProgress(handlers.onProgress);
  const unsubStatus = window.electronAPI.onQueueStatus(handlers.onStatus);
  return () => {
    unsubProgress();
    unsubStatus();
  };
}
