import React, { useMemo, useState } from 'react';
import { History, Search, Trash2 } from 'lucide-react';
import { formatBytes } from '../../core/mediaInspector';
import type { HistoryEntry } from '../../types/media';

interface HistoryViewProps {
  entries: HistoryEntry[];
  onClearHistory: () => void;
}

type HistoryFilter = 'all' | 'completed' | 'failed';

export function HistoryView({ entries, onClearHistory }: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.fileName.toLowerCase().includes(q) ||
        entry.presetName.toLowerCase().includes(q) ||
        entry.targetFormat.toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Conversion History
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Local ledger of real completed, failed, or cancelled FFmpeg jobs.
          </p>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          disabled={entries.length === 0}
          className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/70">
          {(['all', 'completed', 'failed'] as HistoryFilter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by file or preset..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121926] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* History Ledger */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <History className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              No conversion records yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Helal Video Converter never fabricates history records. Completed local conversions executed through Electron + FFmpeg will be logged here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pl-5 pr-3">File Name</th>
                  <th className="py-2.5 px-3">Preset</th>
                  <th className="py-2.5 px-3 text-right">Input Size</th>
                  <th className="py-2.5 px-3 text-right">Output Size</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80 text-xs">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pl-5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                      {entry.fileName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {entry.presetName}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {formatBytes(entry.inputSizeBytes)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {entry.outputSizeBytes !== null ? formatBytes(entry.outputSizeBytes) : '—'}
                    </td>
                    <td className="py-3 px-3 capitalize font-medium text-slate-700 dark:text-slate-200">
                      {entry.status}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {new Date(entry.completedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
