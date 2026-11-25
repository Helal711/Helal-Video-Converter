import React from 'react';
import {
  LayoutDashboard,
  Film,
  Minimize2,
  Music,
  Scissors,
  Maximize2,
  Image as ImageIcon,
  Layers,
  History,
  Settings,
  Monitor,
} from 'lucide-react';
import { APP_MODULES } from '../../core/modules';
import type { AppModuleId, ModuleDefinition, RuntimeCapabilities } from '../../types/media';

interface SidebarProps {
  activeModule: AppModuleId;
  onSelectModule: (moduleId: AppModuleId) => void;
  queueCount: number;
  runtime: RuntimeCapabilities;
}

const MODULE_ICONS: Record<AppModuleId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  'video-converter': Film,
  'video-compressor': Minimize2,
  'audio-converter': Music,
  'video-trimmer': Scissors,
  'video-resizer': Maximize2,
  'video-to-gif': ImageIcon,
  'batch-converter': Layers,
  history: History,
  settings: Settings,
};

function renderReadinessHint(mod: ModuleDefinition, queueCount: number) {
  if (mod.id === 'dashboard' && queueCount > 0) {
    return (
      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {queueCount}
      </span>
    );
  }
  if (mod.readiness === 'awaiting-backend') {
    return (
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        Pending
      </span>
    );
  }
  if (mod.readiness === 'staged') {
    return (
      <span className="text-[11px] text-blue-600 dark:text-blue-400">
        Staged
      </span>
    );
  }
  return null;
}

export function Sidebar({
  activeModule,
  onSelectModule,
  queueCount,
  runtime,
}: SidebarProps) {
  const overviewModules = APP_MODULES.filter((m) => m.id === 'dashboard');
  const processingModules = APP_MODULES.filter(
    (m) =>
      m.id !== 'dashboard' &&
      m.id !== 'history' &&
      m.id !== 'settings',
  );
  const systemModules = APP_MODULES.filter(
    (m) => m.id === 'history' || m.id === 'settings',
  );

  const renderGroup = (title: string, items: ModuleDefinition[]) => (
    <div className="space-y-1">
      <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      {items.map((mod) => {
        const Icon = MODULE_ICONS[mod.id];
        const isActive = activeModule === mod.id;
        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => onSelectModule(mod.id)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 font-medium'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="truncate whitespace-nowrap">{mod.label}</span>
            </span>
            {renderReadinessHint(mod, queueCount)}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1520] select-none">
      {/* Brand Lockup */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/90">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
          <Film className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            Helal Video Converter
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav
        aria-label="Primary modules"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {renderGroup('Workspace', overviewModules)}
        {renderGroup('Processing Modules', processingModules)}
        {renderGroup('Records & System', systemModules)}
      </nav>

      {/* Honest Host Environment Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/90">
        <div className="px-2.5 py-2 rounded-lg bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <Monitor className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="truncate">
              {runtime.environment === 'electron-desktop'
                ? 'Electron Desktop'
                : 'Web Preview Shell'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {runtime.ffmpegDetected
              ? 'FFmpeg & FFprobe connected'
              : 'FFmpeg runs in Electron desktop build'}
          </p>
        </div>
      </div>
    </aside>
  );
}
