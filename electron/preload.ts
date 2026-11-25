import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';

const electronAPI = {
  getRuntimeCapabilities: (overrides?: {
    ffmpegBinaryPath?: string;
    ffprobeBinaryPath?: string;
  }) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_RUNTIME, overrides),

  selectMediaFiles: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILES),

  selectOutputDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY),

  getPathForFile: (file: File): string | null => {
    try {
      const resolved = webUtils.getPathForFile(file);
      return resolved || null;
    } catch {
      return null;
    }
  },

  probeMediaFile: (filePath: string, ffprobeBinaryPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEDIA_PROBE, filePath, ffprobeBinaryPath),

  startQueue: (request: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_START, request),

  cancelQueueJob: (jobId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CANCEL_JOB, jobId),

  cancelAllQueueJobs: () =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CANCEL_ALL),

  openPathInExplorer: (targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_PATH, targetPath),

  revealFileInExplorer: (targetPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL_REVEAL_FILE, targetPath),

  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),

  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),

  onQueueProgress: (callback: (event: unknown) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.QUEUE_JOB_PROGRESS, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.QUEUE_JOB_PROGRESS, subscription);
    };
  },

  onQueueStatus: (callback: (event: unknown) => void) => {
    const subscription = (_event: IpcRendererEvent, payload: unknown) => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.QUEUE_JOB_STATUS, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.QUEUE_JOB_STATUS, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
