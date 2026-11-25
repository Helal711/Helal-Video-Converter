import type { MediaKind, MediaMetadata } from '../types/media';

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v', 'ts', 'mts', '3gp',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff',
]);

export function extractExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

export function detectMediaKind(fileName: string, mimeType: string): MediaKind {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  const ext = extractExtension(fileName);
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  return 'unknown';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value >= 100 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function emptyMediaMetadata(
  source: MediaMetadata['metadataSource'] = 'file-header-only',
  sizeBytes?: number | null,
): MediaMetadata {
  return {
    containerFormat: null,
    durationSeconds: null,
    sizeBytes: sizeBytes ?? null,
    width: null,
    height: null,
    videoCodec: null,
    audioCodec: null,
    frameRate: null,
    bitrateKbps: null,
    audioChannels: null,
    audioChannelLayout: null,
    metadataSource: source,
  };
}

/**
 * Inspects a local File in browser preview mode using native HTML5 media elements.
 * Only reports real values decoded by the browser; never fabricates codecs or bitrates.
 */
export function inspectLocalBrowserFile(file: File): Promise<MediaMetadata> {
  const kind = detectMediaKind(file.name, file.type);

  if (kind === 'unknown') {
    return Promise.resolve(emptyMediaMetadata('file-header-only', file.size));
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const element =
      kind === 'video' ? document.createElement('video') : document.createElement('audio');
    element.preload = 'metadata';

    let settled = false;
    const finish = (metadata: MediaMetadata) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      element.removeAttribute('src');
      element.load();
      resolve(metadata);
    };

    const timeout = window.setTimeout(() => {
      finish(emptyMediaMetadata('file-header-only', file.size));
    }, 2500);

    element.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const duration = Number.isFinite(element.duration) ? element.duration : null;
      const isVideoEl = element instanceof HTMLVideoElement;
      const width = isVideoEl && element.videoWidth > 0 ? element.videoWidth : null;
      const height = isVideoEl && element.videoHeight > 0 ? element.videoHeight : null;

      finish({
        containerFormat: extractExtension(file.name).toUpperCase() || null,
        durationSeconds: duration,
        sizeBytes: file.size,
        width,
        height,
        videoCodec: null,
        audioCodec: null,
        frameRate: null,
        bitrateKbps:
          duration && duration > 0 ? Math.round((file.size * 8) / duration / 1000) : null,
        audioChannels: null,
        audioChannelLayout: null,
        metadataSource: 'html5-local',
      });
    };

    element.onerror = () => {
      window.clearTimeout(timeout);
      finish(emptyMediaMetadata('file-header-only', file.size));
    };

    element.src = objectUrl;
  });
}
