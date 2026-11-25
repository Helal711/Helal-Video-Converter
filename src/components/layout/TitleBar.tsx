import React from 'react';
import { FolderPlus, Moon, Sun } from 'lucide-react';
import type { ModuleDefinition, RuntimeCapabilities, ThemeMode } from '../../types/media';

interface TitleBarProps {
  activeModule: ModuleDefinition;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onAddFilesClick: () => void;
  runtime: RuntimeCapabilities;
}

export function TitleBar({
  activeModule,
  theme,
  onToggleTheme,
  onAddFilesClick,
  runtime,
}: TitleBarProps) {
  return (
    <header className="h-14 shrink-0 px-6 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0F1520]/95">
      {/* Contextual Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          Helal Studio
        </span>
        <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
          /
        </span>
        <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
          {activeModule.label}
        </h1>
        <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-700">
          ·
        </span>
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {activeModule.readinessLabel}
        </span>
      </div>

      {/* Right Workspace Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {runtime.environment === 'electron-desktop'
            ? 'Local Desktop IPC'
            : 'Browser Preview Mode'}
        </span>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/70 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-slate-600" />
              <span>Dark</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onAddFilesClick}
          className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0F1520]"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Add Media</span>
        </button>
      </div>
    </header>
  );
}
