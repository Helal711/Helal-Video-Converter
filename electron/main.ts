import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import { existsSync, mkdirSync, promises as fs, statSync, writeFileSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from './ipc/channels';
import { resolveAndVerifyBinary } from './services/binaryManager';
import { probeMediaFile } from './services/ffprobeService';
import { validateOutputDirectory } from './services/pathValidator';
import { ConversionQueueManager, QueueStartRequest } from './services/queueManager';

const APP_PROTOCOL = 'app';
const APP_HOST = 'bundle';
const APP_ORIGIN = `${APP_PROTOCOL}://${APP_HOST}`;

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

let mainWindow: BrowserWindow | null = null;
const queueManager = new ConversionQueueManager();
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'helal-settings.json');
const LOG_DIR = () => path.join(app.getPath('userData'), 'logs');
const STARTUP_LOG_FILE = () => path.join(LOG_DIR(), 'startup.log');

// Register secure standard scheme before app ready so ES modules, CSS, localStorage, and CSP work without file:// CORS restrictions
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: false,
    },
  },
]);

// Prevent Windows DX11/ANGLE GPU compositing black screens (and AV GPU-hook conflicts) while keeping sandbox & contextIsolation enabled.
// Users can opt into hardware UI compositing with `--enable-gpu`.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.helal.videoconverter');
  if (!process.argv.includes('--enable-gpu')) {
    app.disableHardwareAcceleration();
  }
}

function writeStartupLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  const sanitized = message.replace(/[\r\n]+/g, ' ').slice(0, 1000);
  const line = `[${new Date().toISOString()}] [${level}] ${sanitized}\n`;
  try {
    const dir = LOG_DIR();
    mkdirSync(dir, { recursive: true });
    const logPath = STARTUP_LOG_FILE();
    if (existsSync(logPath) && statSync(logPath).size > 256 * 1024) {
      writeFileSync(logPath, '', 'utf-8');
    }
    writeFileSync(logPath, line, { encoding: 'utf-8', flag: 'a' });
  } catch {
    // Ignore logging I/O failures
  }
  if (level === 'ERROR') {
    console.error(line.trim());
  }
}

function getValidatedDevServerUrl(): string | null {
  if (app.isPackaged) return null;
  const raw = process.env.VITE_DEV_SERVER_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString();
    }
  } catch {
    // Ignore malformed dev URL
  }
  return null;
}

function isAllowedAppUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith(`${APP_ORIGIN}/`)) {
    return true;
  }
  const devUrl = getValidatedDevServerUrl();
  if (devUrl) {
    try {
      return new URL(rawUrl).origin === new URL(devUrl).origin;
    } catch {
      return false;
    }
  }
  return false;
}

function assertTrustedIpcSender(event: Electron.IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isAllowedAppUrl(senderUrl)) {
    throw new Error('Blocked IPC request from untrusted frame origin.');
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showLoadErrorFallback(win: BrowserWindow, reason: string): void {
  if (win.isDestroyed()) return;
  if (win.webContents.getURL().startsWith('data:text/html;')) return;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Helal Video Converter - Startup Error</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0B0F17; color: #F1F5F9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .card { max-width: 560px; width: 100%; background: #121926; border: 1px solid #1E293B; border-radius: 12px; padding: 24px; }
  h1 { margin: 0 0 12px; font-size: 18px; }
  p { margin: 0 0 12px; font-size: 13px; color: #94A3B8; line-height: 1.5; }
  pre { margin: 0; padding: 12px; background: #020617; border: 1px solid #1E293B; border-radius: 8px; font-size: 12px; color: #FCA5A5; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
  <div class="card">
    <h1>Unable to load Helal Video Converter interface</h1>
    <p>Startup encountered a renderer loading error. Details have been written to the local userData startup log.</p>
    <pre>${escapeHtml(reason)}</pre>
  </div>
</body>
</html>`;
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  if (!win.isVisible()) {
    win.show();
  }
}

function registerAppProtocol(): void {
  const distRoot = path.resolve(__dirname, '../dist');
  const distWithSep = distRoot.endsWith(path.sep) ? distRoot : `${distRoot}${path.sep}`;

  protocol.handle(APP_PROTOCOL, async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let reqUrl: URL;
    try {
      reqUrl = new URL(request.url);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    if (reqUrl.hostname !== APP_HOST) {
      return new Response('Not Found', { status: 404 });
    }

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(reqUrl.pathname);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    if (decodedPath.includes('\0')) {
      return new Response('Bad Request', { status: 400 });
    }

    const relativePath = decodedPath.replace(/^\/+/, '') || 'index.html';
    const targetPath = path.resolve(distRoot, relativePath);

    if (targetPath !== distRoot && !targetPath.startsWith(distWithSep)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.readFile(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': PRODUCTION_CSP,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function sanitizeSettingsPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid settings payload.');
  }
  const input = raw as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  if (input.theme === 'dark' || input.theme === 'light') {
    clean.theme = input.theme;
  }
  if (typeof input.defaultOutputDirectory === 'string' && !input.defaultOutputDirectory.includes('\0')) {
    clean.defaultOutputDirectory = input.defaultOutputDirectory.slice(0, 512);
  }
  if (typeof input.ffmpegBinaryPath === 'string' && !input.ffmpegBinaryPath.includes('\0')) {
    clean.ffmpegBinaryPath = input.ffmpegBinaryPath.slice(0, 512);
  }
  if (typeof input.ffprobeBinaryPath === 'string' && !input.ffprobeBinaryPath.includes('\0')) {
    clean.ffprobeBinaryPath = input.ffprobeBinaryPath.slice(0, 512);
  }
  if (
    input.hardwareAcceleration === 'auto' ||
    input.hardwareAcceleration === 'nvenc' ||
    input.hardwareAcceleration === 'qsv' ||
    input.hardwareAcceleration === 'amf' ||
    input.hardwareAcceleration === 'cpu'
  ) {
    clean.hardwareAcceleration = input.hardwareAcceleration;
  }
  if (typeof input.maxConcurrentJobs === 'number' && Number.isFinite(input.maxConcurrentJobs)) {
    clean.maxConcurrentJobs = Math.min(4, Math.max(1, Math.round(input.maxConcurrentJobs)));
  }
  if (
    input.existingFilePolicy === 'rename' ||
    input.existingFilePolicy === 'overwrite' ||
    input.existingFilePolicy === 'skip'
  ) {
    clean.existingFilePolicy = input.existingFilePolicy;
  }
  if (typeof input.preserveMetadata === 'boolean') {
    clean.preserveMetadata = input.preserveMetadata;
  }
  if (typeof input.openOutputFolderOnComplete === 'boolean') {
    clean.openOutputFolderOnComplete = input.openOutputFolderOnComplete;
  }

  return clean;
}

function createMainWindow(): void {
  const iconCandidate = path.join(__dirname, '../build/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    show: false,
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

  const win = mainWindow;

  const showFallbackTimer = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      writeStartupLog('WARN', 'ready-to-show delayed; forcing BrowserWindow visibility.');
      win.show();
    }
  }, 2500);

  win.once('ready-to-show', () => {
    clearTimeout(showFallbackTimer);
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
    }
  });

  // Restrict popup creation and navigation strictly to the app origin
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedAppUrl(navigationUrl) && !navigationUrl.startsWith('data:text/html;')) {
      event.preventDefault();
      writeStartupLog('WARN', `Blocked navigation attempt to disallowed URL: ${navigationUrl}`);
    }
  });

  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      const reason = `Renderer load failed (${errorCode}: ${errorDescription}) for ${validatedURL}`;
      writeStartupLog('ERROR', reason);
      showLoadErrorFallback(win, reason);
    },
  );

  win.webContents.on('render-process-gone', (_event, details) => {
    const reason = `Renderer process terminated unexpectedly: ${details.reason} (exitCode=${details.exitCode})`;
    writeStartupLog('ERROR', reason);
    showLoadErrorFallback(win, reason);
  });

  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') {
      writeStartupLog('ERROR', `Renderer console error: ${details.message}`);
    }
  });

  const devServerUrl = getValidatedDevServerUrl();
  const targetUrl = devServerUrl ?? `${APP_ORIGIN}/index.html`;
  writeStartupLog(
    'INFO',
    `Loading UI from ${devServerUrl ? 'dev-server' : `${APP_ORIGIN}/index.html`} (packaged=${app.isPackaged}, gpuDisabled=${process.platform === 'win32' && !process.argv.includes('--enable-gpu')})`,
  );

  win.loadURL(targetUrl).catch((err) => {
    const reason = err instanceof Error ? err.message : String(err);
    writeStartupLog('ERROR', `loadURL rejected: ${reason}`);
    showLoadErrorFallback(win, reason);
  });

  win.on('closed', () => {
    clearTimeout(showFallbackTimer);
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_GET_RUNTIME,
    async (
      event,
      overrides?: { ffmpegBinaryPath?: string; ffprobeBinaryPath?: string },
    ) => {
      assertTrustedIpcSender(event);
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

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async (event) => {
    assertTrustedIpcSender(event);
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

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async (event) => {
    assertTrustedIpcSender(event);
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
    async (event, filePath: unknown, ffprobeBinaryPath?: unknown) => {
      assertTrustedIpcSender(event);
      const override = typeof ffprobeBinaryPath === 'string' ? ffprobeBinaryPath : undefined;
      return probeMediaFile(filePath as string, override);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.QUEUE_START,
    async (event, rawRequest: QueueStartRequest) => {
      assertTrustedIpcSender(event);
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

  ipcMain.handle(IPC_CHANNELS.QUEUE_CANCEL_JOB, async (event, jobId: unknown) => {
    assertTrustedIpcSender(event);
    if (typeof jobId !== 'string' || !jobId.trim()) return false;
    return queueManager.cancelJob(jobId);
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_CANCEL_ALL, async (event) => {
    assertTrustedIpcSender(event);
    return queueManager.cancelAll();
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_PATH, async (event, targetPath: unknown) => {
    assertTrustedIpcSender(event);
    const validatedDir = await validateOutputDirectory(targetPath);
    await shell.openPath(validatedDir);
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_REVEAL_FILE, async (event, targetPath: unknown) => {
    assertTrustedIpcSender(event);
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, async (event) => {
    assertTrustedIpcSender(event);
    try {
      const content = await fs.readFile(SETTINGS_FILE(), 'utf-8');
      return sanitizeSettingsPayload(JSON.parse(content));
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (event, settings: unknown) => {
    assertTrustedIpcSender(event);
    const sanitized = sanitizeSettingsPayload(settings);
    await fs.writeFile(SETTINGS_FILE(), JSON.stringify(sanitized, null, 2), 'utf-8');
  });
}

process.on('uncaughtException', (err) => {
  writeStartupLog('ERROR', `Uncaught main process exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  writeStartupLog(
    'ERROR',
    `Unhandled main process rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
  );
});

app.on('child-process-gone', (_event, details) => {
  writeStartupLog(
    'WARN',
    `Child process exited: type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`,
  );
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

  registerAppProtocol();
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
