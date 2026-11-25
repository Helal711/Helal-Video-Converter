import React from 'react';
import { ArrowRight, CheckCircle2, Clock, Cpu, HardDrive } from 'lucide-react';
import { formatBytes } from '../../core/mediaInspector';
import { APP_MODULES } from '../../core/modules';
import { DropZone } from '../common/DropZone';
import { QueueTable } from './QueueTable';
import type {
  AppModuleId,
  AppSettings,
  QueueItem,
  RuntimeCapabilities,
} from '../../types/media';

interface DashboardViewProps {
  queue: QueueItem[];
  runtime: RuntimeCapabilities;
  settings: AppSettings;
  isInspecting: boolean;
  runtimeNotice: string | null;
  onFilesDropped: (files: File[]) => void;
  onBrowseClick: () => void;
  onChangePreset: (itemId: string, presetId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onCancelItem: (itemId: string) => void;
  onCancelAll: () => void;
  onClearQueue: () => void;
  onAttemptStartQueue: () => void;
  onRevealOutput: (outputPath: string) => void;
  onNavigateModule: (moduleId: AppModuleId) => void;
}

export function DashboardView({
  queue,
  runtime,
  settings,
  isInspecting,
  runtimeNotice,
  onFilesDropped,
  onBrowseClick,
  onChangePreset,
  onRemoveItem,
  onCancelItem,
  onCancelAll,
  onClearQueue,
  onAttemptStartQueue,
  onRevealOutput,
  onNavigateModule,
}: DashboardViewProps) {
  const totalBytes = queue.reduce((sum, item) => sum + item.sizeBytes, 0);
  const implementedCount = APP_MODULES.filter((m) => m.readiness === 'implemented').length;
  const pendingCount = APP_MODULES.length - implementedCount;

  const toolModules = APP_MODULES.filter(
    (m) => m.id !== 'dashboard' && m.id !== 'settings',
  );

  return (
    <div className="space-y-6">
      {/* Intro & Architectural Scope */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Workstation Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Stage local media files, inspect stream metadata with FFprobe, and run FFmpeg conversions locally.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateModule('settings')}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          Configure FFmpeg Paths & Output Folder
        </button>
      </div>

      {/* 4-Column Runtime & Queue Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Staged Queue</span>
            <HardDrive className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {queue.length} {queue.length === 1 ? 'File' : 'Files'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {formatBytes(totalBytes)} local payload
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Host Runtime</span>
            <Cpu className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {runtime.environment === 'electron-desktop'
              ? 'Electron Desktop'
              : 'Browser Preview'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {runtime.environment === 'electron-desktop'
              ? `contextIsolation: ${runtime.contextIsolation ? 'enabled' : 'disabled'} · sandbox: ${runtime.sandbox ? 'on' : 'off'}`
              : 'Electron preload bridge ready'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>FFmpeg / FFprobe</span>
            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {runtime.ffmpegDetected && runtime.ffprobeDetected
              ? 'Binaries Verified'
              : runtime.environment === 'electron-desktop'
                ? 'Binary Missing'
                : 'Awaiting Desktop'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            {runtime.ffmpegVersion ?? `Target: ${settings.ffmpegBinaryPath}`}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Module Architecture</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {implementedCount} / {APP_MODULES.length} Ready
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {pendingCount} scheduled for later phases
          </div>
        </div>
      </div>

      {/* Primary Media DropZone */}
      <DropZone
        onFilesDropped={onFilesDropped}
        onBrowseClick={onBrowseClick}
        compact={queue.length > 0}
        isInspecting={isInspecting}
      />

      {/* Active Conversion Queue */}
      <QueueTable
        items={queue}
        runtime={runtime}
        outputDirectory={settings.defaultOutputDirectory}
        onChangePreset={onChangePreset}
        onRemoveItem={onRemoveItem}
        onCancelItem={onCancelItem}
        onCancelAll={onCancelAll}
        onClearQueue={onClearQueue}
        onAttemptStartQueue={onAttemptStartQueue}
        onRevealOutput={onRevealOutput}
        runtimeNotice={runtimeNotice}
      />

      {/* Modular Roadmap & Direct Tool Access */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Processing Modules & Integration Status
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Implemented modules vs modules scheduled for future phases
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {toolModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigateModule(mod.id)}
              className="group text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] hover:border-blue-400 dark:hover:border-blue-500/60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {mod.label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
              </div>

              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                {mod.shortDescription}
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                <span
                  className={
                    mod.readiness === 'implemented'
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }
                >
                  {mod.readinessLabel}
                </span>
                <span className="font-mono text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                  {mod.id}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
