import React, { useState } from 'react';
import { FolderOpen, RotateCcw, Save } from 'lucide-react';
import { openDesktopDirectoryDialog } from '../../core/desktopBridge';
import { DEFAULT_SETTINGS } from '../../core/storage';
import type {
  AppSettings,
  ExistingFilePolicy,
  HardwareAcceleration,
  RuntimeCapabilities,
  ThemeMode,
} from '../../types/media';

interface SettingsViewProps {
  settings: AppSettings;
  runtime: RuntimeCapabilities;
  onUpdateSettings: (next: AppSettings) => void;
  onVerifyBinaries: (ffmpegPath: string, ffprobePath: string) => void;
}

export function SettingsView({
  settings,
  runtime,
  onUpdateSettings,
  onVerifyBinaries,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleThemeChange = (theme: ThemeMode) => {
    const updated = { ...draft, theme };
    setDraft(updated);
    onUpdateSettings(updated);
    setSavedNotice('Theme updated.');
  };

  const handleBrowseDirectory = async () => {
    const chosen = await openDesktopDirectoryDialog();
    if (chosen) {
      setDraft((prev) => ({ ...prev, defaultOutputDirectory: chosen }));
      setSavedNotice(null);
    } else {
      setSavedNotice(
        'Native folder picker is available inside the Electron desktop runtime. You can type a path manually here.',
      );
    }
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateSettings(draft);
    onVerifyBinaries(draft.ffmpegBinaryPath, draft.ffprobeBinaryPath);
    setSavedNotice('Settings saved and binary availability re-verified.');
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
    onUpdateSettings(DEFAULT_SETTINGS);
    onVerifyBinaries(DEFAULT_SETTINGS.ffmpegBinaryPath, DEFAULT_SETTINGS.ffprobeBinaryPath);
    setSavedNotice('Restored default settings.');
  };

  return (
    <form onSubmit={handleSave} className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Settings
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure desktop appearance, local output folders, FFmpeg/FFprobe binary paths, and worker preferences.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 text-xs text-blue-800 dark:text-blue-200"
        >
          {savedNotice}
        </div>
      )}

      {/* Appearance & Output */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Interface Theme
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Switch between professional dark studio mode and high-contrast light mode.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            {(['dark', 'light'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleThemeChange(mode)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  draft.theme === mode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-2">
          <label
            htmlFor="output-dir"
            className="block font-display text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Default Output Directory
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Destination Windows folder where converted media files will be written.
          </p>
          <div className="pt-1 flex items-center gap-2.5">
            <input
              id="output-dir"
              type="text"
              value={draft.defaultOutputDirectory}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, defaultOutputDirectory: e.target.value }))
              }
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleBrowseDirectory}
              className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>
          </div>
        </div>
      </section>

      {/* FFmpeg & FFprobe Binaries */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="ffmpeg-path"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              FFmpeg Executable Path
            </label>
            <input
              id="ffmpeg-path"
              type="text"
              value={draft.ffmpegBinaryPath}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, ffmpegBinaryPath: e.target.value }))
              }
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {runtime.ffmpegDetected
                ? `Detected (${runtime.ffmpegSource}): ${runtime.ffmpegVersion}`
                : 'Uses configured path, bundled resources/bin/win32-x64/ffmpeg.exe, or system PATH.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ffprobe-path"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              FFprobe Executable Path
            </label>
            <input
              id="ffprobe-path"
              type="text"
              value={draft.ffprobeBinaryPath}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, ffprobeBinaryPath: e.target.value }))
              }
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {runtime.ffprobeDetected
                ? `Detected (${runtime.ffprobeSource}): ${runtime.ffprobeVersion}`
                : 'Used for stream codec, framerate, channel, and bitrate inspection.'}
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="hw-accel"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Hardware Acceleration
            </label>
            <select
              id="hw-accel"
              value={draft.hardwareAcceleration}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  hardwareAcceleration: e.target.value as HardwareAcceleration,
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="auto">Auto Detect</option>
              <option value="nvenc">NVIDIA NVENC</option>
              <option value="qsv">Intel QuickSync (QSV)</option>
              <option value="amf">AMD AMF</option>
              <option value="cpu">CPU Software Only</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="max-jobs"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Concurrent Queue Workers
            </label>
            <select
              id="max-jobs"
              value={draft.maxConcurrentJobs}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maxConcurrentJobs: Number(e.target.value),
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Worker (Sequential)</option>
              <option value={2}>2 Workers (Balanced)</option>
              <option value={3}>3 Workers</option>
              <option value={4}>4 Workers (High CPU)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="overwrite-policy"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Existing File Policy
            </label>
            <select
              id="overwrite-policy"
              value={draft.existingFilePolicy}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  existingFilePolicy: e.target.value as ExistingFilePolicy,
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rename">Auto-Rename (_1, _2)</option>
              <option value="overwrite">Overwrite Existing</option>
              <option value="skip">Skip Existing File</option>
            </select>
          </div>
        </div>

        <div className="p-5 flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.preserveMetadata}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, preserveMetadata: e.target.checked }))
              }
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span>Preserve container metadata tags (-map_metadata 0)</span>
          </label>

          <label className="inline-flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.openOutputFolderOnComplete}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  openOutputFolderOnComplete: e.target.checked,
                }))
              }
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span>Reveal output folder after batch completion</span>
          </label>
        </div>
      </section>
    </form>
  );
}
