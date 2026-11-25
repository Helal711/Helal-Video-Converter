/**
 * Central IPC channel registry for Helal Video Converter.
 * All renderer <-> main communication must strictly use these whitelisted channels.
 */
export const IPC_CHANNELS = {
  /** Query Electron runtime, sandbox flags, and FFmpeg/FFprobe binary availability. */
  APP_GET_RUNTIME: 'app:get-runtime-capabilities',

  /** Open native multi-file picker dialog for video/audio inputs. */
  DIALOG_SELECT_FILES: 'dialog:select-media-files',

  /** Open native folder picker dialog for default output directory. */
  DIALOG_SELECT_DIRECTORY: 'dialog:select-output-directory',

  /** Inspect a local media file via FFprobe and return normalized stream metadata. */
  MEDIA_PROBE: 'media:probe-file',

  /** Start processing queued jobs via ConversionQueueManager (bounded concurrency). */
  QUEUE_START: 'queue:start',

  /** Cancel a single queued or active FFmpeg conversion job by jobId. */
  QUEUE_CANCEL_JOB: 'queue:cancel-job',

  /** Cancel all pending and active FFmpeg conversion jobs. */
  QUEUE_CANCEL_ALL: 'queue:cancel-all',

  /** Main -> Renderer push event carrying real FFmpeg progress metrics. */
  QUEUE_JOB_PROGRESS: 'queue:job-progress',

  /** Main -> Renderer push event carrying job lifecycle transitions. */
  QUEUE_JOB_STATUS: 'queue:job-status',

  /** Open a validated folder path in Windows Explorer / OS file manager. */
  SHELL_OPEN_PATH: 'shell:open-path',

  /** Reveal a validated output file in Windows Explorer / OS file manager. */
  SHELL_REVEAL_FILE: 'shell:reveal-file',

  /** Load persisted desktop settings from userData JSON. */
  SETTINGS_LOAD: 'settings:load',

  /** Save desktop settings to userData JSON. */
  SETTINGS_SAVE: 'settings:save',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
