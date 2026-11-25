import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { DashboardView } from './components/dashboard/DashboardView';
import { VideoConverterView } from './components/modules/VideoConverterView';
import { ModulePlaceholderView } from './components/modules/ModulePlaceholderView';
import { HistoryView } from './components/modules/HistoryView';
import { SettingsView } from './components/modules/SettingsView';
import { DEFAULT_VIDEO_CONVERSION_CONFIG } from './core/conversionConfig';
import {
  BROWSER_FALLBACK_CAPABILITIES,
  cancelAllDesktopJobs,
  cancelDesktopJob,
  fetchRuntimeCapabilities,
  getDroppedFilePath,
  loadSettingsFromDesktop,
  openDesktopFileDialog,
  persistSettingsToDesktop,
  probeViaDesktopRuntime,
  revealDesktopFile,
  startDesktopQueue,
  subscribeDesktopQueueEvents,
} from './core/desktopBridge';
import {
  detectMediaKind,
  emptyMediaMetadata,
  extractExtension,
  inspectLocalBrowserFile,
} from './core/mediaInspector';
import { getModuleById } from './core/modules';
import { CONVERSION_PRESETS, getPresetById } from './core/presets';
import {
  loadStoredHistory,
  loadStoredSettings,
  saveStoredHistory,
  saveStoredSettings,
} from './core/storage';
import type {
  AppModuleId,
  AppSettings,
  HistoryEntry,
  QueueItem,
  RuntimeCapabilities,
  VideoConversionConfig,
} from './types/media';

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadStoredHistory());
  const [activeModule, setActiveModule] = useState<AppModuleId>('dashboard');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeCapabilities>(
    BROWSER_FALLBACK_CAPABILITIES,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queueRef = useRef<QueueItem[]>(queue);
  queueRef.current = queue;

  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  // Sync Tailwind v4 `.dark` class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const refreshRuntime = useCallback(
    async (ffmpegBinaryPath?: string, ffprobeBinaryPath?: string) => {
      const caps = await fetchRuntimeCapabilities({
        ffmpegBinaryPath: ffmpegBinaryPath ?? settingsRef.current.ffmpegBinaryPath,
        ffprobeBinaryPath: ffprobeBinaryPath ?? settingsRef.current.ffprobeBinaryPath,
      });
      setRuntime(caps);
    },
    [],
  );

  // Hydrate settings from Electron userData and verify binaries on mount
  useEffect(() => {
    let active = true;
    (async () => {
      const desktopSettings = await loadSettingsFromDesktop().catch(() => null);
      const merged = desktopSettings
        ? { ...loadStoredSettings(), ...desktopSettings }
        : loadStoredSettings();
      if (active && desktopSettings) {
        setSettings(merged);
        saveStoredSettings(merged);
      }
      const caps = await fetchRuntimeCapabilities({
        ffmpegBinaryPath: merged.ffmpegBinaryPath,
        ffprobeBinaryPath: merged.ffprobeBinaryPath,
      });
      if (active) {
        setRuntime(caps);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Subscribe to real Electron FFmpeg progress and job status events
  useEffect(() => {
    return subscribeDesktopQueueEvents({
      onProgress: ({ jobId, progress }) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === jobId
              ? {
                  ...item,
                  status: 'processing',
                  statusDetail: progress.currentStage,
                  progress,
                  outputSizeBytes: progress.outputSizeBytes ?? item.outputSizeBytes,
                }
              : item,
          ),
        );
      },
      onStatus: (event) => {
        const currentItem = queueRef.current.find((i) => i.id === event.jobId);

        setQueue((prev) =>
          prev.map((item) =>
            item.id === event.jobId
              ? {
                  ...item,
                  status: event.status,
                  statusDetail: event.statusDetail,
                  outputPath: event.outputPath ?? item.outputPath,
                  outputSizeBytes: event.outputSizeBytes ?? item.outputSizeBytes,
                  errorMessage: event.errorMessage,
                  progress:
                    event.status === 'processing'
                      ? item.progress
                      : event.status === 'completed' && item.progress
                        ? { ...item.progress, percent: 100, etaSeconds: 0 }
                        : null,
                }
              : item,
          ),
        );

        // Record terminal job states into persistent Conversion History
        if (
          currentItem &&
          (event.status === 'completed' ||
            event.status === 'failed' ||
            event.status === 'cancelled')
        ) {
          const entry: HistoryEntry = {
            id: `${event.jobId}_${Date.now()}`,
            fileName: currentItem.fileName,
            sourceFormat: currentItem.extension.toUpperCase() || 'FILE',
            targetFormat: currentItem.conversionConfig.container.toUpperCase(),
            presetName: `${currentItem.conversionConfig.container.toUpperCase()} · ${currentItem.conversionConfig.videoCodec.toUpperCase()} / ${currentItem.conversionConfig.audioCodec.toUpperCase()} (${currentItem.conversionConfig.resolution})`,
            inputSizeBytes: currentItem.sizeBytes,
            outputSizeBytes: event.outputSizeBytes,
            outputPath: event.outputPath ?? settingsRef.current.defaultOutputDirectory,
            completedAt: new Date().toISOString(),
            elapsedSeconds: event.elapsedSeconds,
            status: event.status,
          };

          setHistory((prev) => {
            const next = [entry, ...prev].slice(0, 200);
            saveStoredHistory(next);
            return next;
          });
        }
      },
    });
  }, []);

  const handleUpdateSettings = (next: AppSettings) => {
    setSettings(next);
    saveStoredSettings(next);
    void persistSettingsToDesktop(next);
  };

  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleUpdateSettings({ ...settings, theme: nextTheme });
  };

  const ingestBrowserFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsInspecting(true);
    setRuntimeNotice(null);

    try {
      const inspected = await Promise.all(
        files.map(async (file): Promise<QueueItem> => {
          const extension = extractExtension(file.name);
          const kind = detectMediaKind(file.name, file.type);
          const desktopPath = getDroppedFilePath(file);

          const metadata =
            desktopPath && runtime.ffprobeDetected
              ? (await probeViaDesktopRuntime(
                  desktopPath,
                  settings.ffprobeBinaryPath,
                ).catch(() => null)) ?? (await inspectLocalBrowserFile(file))
              : await inspectLocalBrowserFile(file);

          const defaultPreset = CONVERSION_PRESETS[0];

          return {
            id: createQueueId(),
            fileName: file.name,
            extension,
            filePath: desktopPath,
            sizeBytes: metadata.sizeBytes ?? file.size,
            mimeType: file.type || 'application/octet-stream',
            kind,
            addedAt: new Date().toISOString(),
            presetId: defaultPreset.id,
            conversionConfig:
              defaultPreset.videoConfig ?? DEFAULT_VIDEO_CONVERSION_CONFIG,
            targetModule: kind === 'audio' ? 'audio-converter' : 'video-converter',
            status: 'queued',
            statusDetail:
              desktopPath && runtime.ffmpegDetected
                ? 'Ready for FFmpeg'
                : 'Staged locally',
            progress: null,
            outputPath: null,
            outputSizeBytes: null,
            errorMessage: null,
            metadata,
          };
        }),
      );

      setQueue((prev) => [...prev, ...inspected]);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleBrowseFiles = async () => {
    const desktopSelections = await openDesktopFileDialog();
    if (desktopSelections !== null) {
      if (desktopSelections.length === 0) return;
      setIsInspecting(true);
      setRuntimeNotice(null);

      try {
        const defaultPreset = CONVERSION_PRESETS[0];
        const items = await Promise.all(
          desktopSelections.map(async (sel): Promise<QueueItem> => {
            const kind = detectMediaKind(sel.fileName, '');
            const metadata =
              (await probeViaDesktopRuntime(
                sel.filePath,
                settings.ffprobeBinaryPath,
              ).catch(() => null)) ?? emptyMediaMetadata('file-header-only', sel.sizeBytes);

            return {
              id: createQueueId(),
              fileName: sel.fileName,
              extension: sel.extension,
              filePath: sel.filePath,
              sizeBytes: metadata.sizeBytes ?? sel.sizeBytes,
              mimeType: 'application/octet-stream',
              kind,
              addedAt: new Date().toISOString(),
              presetId: defaultPreset.id,
              conversionConfig:
                defaultPreset.videoConfig ?? DEFAULT_VIDEO_CONVERSION_CONFIG,
              targetModule: kind === 'audio' ? 'audio-converter' : 'video-converter',
              status: 'queued',
              statusDetail: 'Ready for FFmpeg',
              progress: null,
              outputPath: null,
              outputSizeBytes: null,
              errorMessage: null,
              metadata,
            };
          }),
        );
        setQueue((prev) => [...prev, ...items]);
      } finally {
        setIsInspecting(false);
      }
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files ? Array.from(event.target.files) : [];
    if (selected.length > 0) {
      void ingestBrowserFiles(selected);
    }
    event.target.value = '';
  };

  const handleChangePreset = (itemId: string, presetId: string) => {
    if (presetId === 'custom-config') return;
    const preset = getPresetById(presetId);
    setQueue((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              presetId,
              conversionConfig:
                preset.videoConfig ?? item.conversionConfig,
            }
          : item,
      ),
    );
  };

  const handleApplyPresetToAll = (presetId: string) => {
    const preset = getPresetById(presetId);
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'processing'
          ? item
          : {
              ...item,
              presetId,
              conversionConfig:
                preset.videoConfig ?? item.conversionConfig,
            },
      ),
    );
  };

  const handleApplyCustomConfigToAll = (config: VideoConversionConfig) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'processing'
          ? item
          : {
              ...item,
              presetId: 'custom-config',
              conversionConfig: config,
            },
      ),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleCancelItem = async (itemId: string) => {
    await cancelDesktopJob(itemId);
  };

  const handleCancelAll = async () => {
    await cancelAllDesktopJobs();
  };

  const handleClearQueue = () => {
    setQueue([]);
    setRuntimeNotice(null);
  };

  const handleAttemptStartQueue = async () => {
    const runnableItems = queue.filter(
      (item) =>
        item.status === 'queued' ||
        item.status === 'awaiting-desktop-runtime' ||
        item.status === 'failed' ||
        item.status === 'cancelled',
    );
    if (runnableItems.length === 0) return;

    if (runtime.environment !== 'electron-desktop') {
      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'awaiting-desktop-runtime',
          statusDetail: 'Awaiting Electron FFmpeg',
        })),
      );
      setRuntimeNotice(
        'Video transcoding is disabled in Browser Preview mode (no simulated conversion). Launch the Electron Windows desktop application with FFmpeg installed to process files locally.',
      );
      return;
    }

    if (!runtime.ffmpegDetected) {
      setRuntimeNotice(
        runtime.binaryWarnings[0] ??
          'FFmpeg binary was not detected. Configure a valid ffmpeg.exe path in Settings.',
      );
      return;
    }

    const itemsWithPaths = runnableItems.filter((item) => Boolean(item.filePath));
    if (itemsWithPaths.length === 0) {
      setRuntimeNotice(
        'Selected files do not expose local filesystem paths. Re-add files using Add Media or Drag & Drop.',
      );
      return;
    }

    setRuntimeNotice(null);

    const response = await startDesktopQueue({
      jobs: itemsWithPaths.map((item) => ({
        jobId: item.id,
        inputPath: item.filePath!,
        fileName: item.fileName,
        config: item.conversionConfig,
        durationSeconds: item.metadata.durationSeconds,
      })),
      outputDirectory: settings.defaultOutputDirectory,
      ffmpegBinaryPath: settings.ffmpegBinaryPath,
      ffprobeBinaryPath: settings.ffprobeBinaryPath,
      hardwareAcceleration: settings.hardwareAcceleration,
      maxConcurrentJobs: settings.maxConcurrentJobs,
      existingFilePolicy: settings.existingFilePolicy,
      preserveMetadata: settings.preserveMetadata,
      openOutputFolderOnComplete: settings.openOutputFolderOnComplete,
    });

    if (!response.started && response.error) {
      setRuntimeNotice(response.error);
    }
  };

  const handleRevealOutput = (outputPath: string) => {
    void revealDesktopFile(outputPath).catch((err) => {
      setRuntimeNotice(err instanceof Error ? err.message : String(err));
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveStoredHistory([]);
  };

  const currentModuleDef = getModuleById(activeModule);

  const renderMainContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <DashboardView
            queue={queue}
            runtime={runtime}
            settings={settings}
            isInspecting={isInspecting}
            runtimeNotice={runtimeNotice}
            onFilesDropped={ingestBrowserFiles}
            onBrowseClick={handleBrowseFiles}
            onChangePreset={handleChangePreset}
            onRemoveItem={handleRemoveItem}
            onCancelItem={handleCancelItem}
            onCancelAll={handleCancelAll}
            onClearQueue={handleClearQueue}
            onAttemptStartQueue={handleAttemptStartQueue}
            onRevealOutput={handleRevealOutput}
            onNavigateModule={setActiveModule}
          />
        );
      case 'video-converter':
        return (
          <VideoConverterView
            queue={queue}
            settings={settings}
            runtime={runtime}
            runtimeNotice={runtimeNotice}
            onApplyPresetToAll={handleApplyPresetToAll}
            onApplyCustomConfigToAll={handleApplyCustomConfigToAll}
            onBrowseClick={handleBrowseFiles}
            onStartQueue={handleAttemptStartQueue}
            onCancelJob={handleCancelItem}
            onCancelAll={handleCancelAll}
          />
        );
      case 'history':
        return (
          <HistoryView
            entries={history}
            onClearHistory={handleClearHistory}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            runtime={runtime}
            onUpdateSettings={handleUpdateSettings}
            onVerifyBinaries={refreshRuntime}
          />
        );
      default:
        return (
          <ModulePlaceholderView
            moduleDef={currentModuleDef}
            onNavigateModule={setActiveModule}
          />
        );
    }
  };

  return (
    <div className="min-h-screen h-screen flex overflow-hidden bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,.mkv,.avi,.mov,.wmv,.flv,.webm,.mp4,.mp3,.wav,.flac,.aac,.m4a"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        queueCount={queue.length}
        runtime={runtime}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TitleBar
          activeModule={currentModuleDef}
          theme={settings.theme}
          onToggleTheme={handleToggleTheme}
          onAddFilesClick={handleBrowseFiles}
          runtime={runtime}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderMainContent()}</div>
        </main>
      </div>
    </div>
  );
}
