import type { AppSettings, HistoryEntry } from '../types/media';

const SETTINGS_KEY = 'helal_video_converter_settings_v1';
const HISTORY_KEY = 'helal_video_converter_history_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultOutputDirectory: 'C:\\Users\\Videos\\HelalOutput',
  ffmpegBinaryPath: 'ffmpeg.exe',
  ffprobeBinaryPath: 'ffprobe.exe',
  hardwareAcceleration: 'auto',
  maxConcurrentJobs: 2,
  existingFilePolicy: 'rename',
  preserveMetadata: true,
  openOutputFolderOnComplete: false,
};

export function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

export function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}
