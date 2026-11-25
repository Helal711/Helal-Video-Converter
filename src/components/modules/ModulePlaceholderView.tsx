import React from 'react';
import { ArrowLeft, Wrench, CheckSquare } from 'lucide-react';
import type { AppModuleId, ModuleDefinition } from '../../types/media';

interface ModulePlaceholderViewProps {
  moduleDef: ModuleDefinition;
  onNavigateModule: (moduleId: AppModuleId) => void;
}

export function ModulePlaceholderView({
  moduleDef,
  onNavigateModule,
}: ModulePlaceholderViewProps) {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
            {moduleDef.readinessLabel}
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {moduleDef.label}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {moduleDef.shortDescription}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateModule('dashboard')}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121926] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Architectural Blueprint Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Awaiting Electron + FFmpeg Backend Phase
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              This module is registered in the application architecture and navigation shell. In keeping with incremental engineering, local FFmpeg execution and filter controls will be connected after the core Electron runner is bound.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Target FFmpeg Pipeline
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs border border-slate-800 overflow-x-auto">
            {moduleDef.targetPipeline}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
            Planned Module Capabilities
          </div>
          <ul className="space-y-2.5">
            {moduleDef.plannedCapabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <CheckSquare className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
