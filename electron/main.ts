import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from './ipc/channels';
import { resolveAndVerifyBinary } from './services/binaryManager';
import { probeMediaFile } from './services/ffprobeService';
import { validateOutputDirectory } from './services/pathValidator';
import { ConversionQueueManager, QueueStartRequest } from './services/queueManager';

let mainWindow: BrowserWindow | null = null;
const queueManager = new ConversionQueueManager();
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'helal-settings.json');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.helal.videoconverter');
}

function createMainWindow(): void {
  const iconCandidate = path.join(__dirname, '../build/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    title: 'Helal Video Converter',
    backgroundColor: '#0B0F17',
    autoHideMenuBar: true,
    ...(existsSync(iconCandidate) ? { icon: iconCandidate } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Restrict navigation to app origin only
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_GET_RUNTIME,
    async (
      _event,
      overrides?: { ffmpegBinaryPath?: string; ffprobeBinaryPath?: string },
    ) => {
      const [ffmpegRes, ffprobeRes] = await Promise.all([
        resolveAndVerifyBinary('ffmpeg', overrides?.ffmpegBinaryPath),
        resolveAndVerifyBinary('ffprobe', overrides?.ffprobeBinaryPath),
      ]);

      const warnings: string[] = [];
      if (!ffmpegRes.available && ffmpegRes.error) warnings.push(ffmpegRes.error);
      if (!ffprobeRes.available && ffprobeRes.error) warnings.push(ffprobeRes.error);

      return {
        environment: 'electron-desktop',
        platform: process.platform,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        ffmpegDetected: ffmpegRes.available,
        ffprobeDetected: ffprobeRes.available,
        ffmpegVersion: ffmpegRes.version,
        ffprobeVersion: ffprobeRes.version,
        ffmpegPath: ffmpegRes.resolvedPath,
        ffprobePath: ffprobeRes.resolvedPath,
        ffmpegSource: ffmpegRes.source,
        ffprobeSource: ffprobeRes.source,
        binaryWarnings: warnings,
      };
    },
  );

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Media Files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media Files',
          extensions: [
            'mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v',
            'ts', 'mts', '3gp', 'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg',
          ],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled) return [];

    const selections = await Promise.all(
      result.filePaths.map(async (filePath) => {
        const stat = await fs.stat(filePath);
        const fileName = path.basename(filePath);
        const extension = path.extname(fileName).replace('.', '').toLowerCase();
        return {
          filePath,
          fileName,
          sizeBytes: stat.size,
          extension,
        };
      }),
    );

    return selections;
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Default Output Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.MEDIA_PROBE,
    async (_event, filePath: unknown, ffprobeBinaryPath?: unknown) => {
      const override = typeof ffprobeBinaryPath === 'string' ? ffprobeBinaryPath : undefined;
      return probeMediaFile(filePath as string, override);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.QUEUE_START,
    async (_event, rawRequest: QueueStartRequest) => {
      return queueManager.startQueue(rawRequest, {
        onProgress: (payload) => {
          mainWindow?.webContents.send(IPC_CHANNELS.QUEUE_JOB_PROGRESS, payload);
        },
        onStatus: (payload) => {
          mainWindow?.webContents.send(IPC_CHANNELS.QUEUE_JOB_STATUS, payload);
        },
      });
    },
  );

  ipcMain.handle(IPC_CHANNELS.QUEUE_CANCEL_JOB, async (_event, jobId: unknown) => {
    if (typeof jobId !== 'string' || !jobId.trim()) return false;
    return queueManager.cancelJob(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_CANCEL_ALL, async () => {
    return queueManager.cancelAll();
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (_event, targetPath: unknown) => {
    const validatedDir = await validateOutputDirectory(targetPath);
    await shell.openPath(validatedDir);
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_REVEAL_FILE, async (_event, targetPath: unknown) => {
    if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath) || targetPath.includes('\0')) {
      throw new Error('Invalid file path for explorer reveal.');
    }
    const resolved = path.resolve(targetPath);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new Error('Output file no longer exists on disk.');
    }
    shell.showItemInFolder(resolved);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async () => {
    try {
      const content = await fs.readFile(SETTINGS_FILE(), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_event, settings: unknown) => {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings payload.');
    }
    await fs.writeFile(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8');
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  queueManager.cancelAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
