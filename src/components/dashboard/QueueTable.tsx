import React from 'react';
import {
  AlertCircle,
  FileQuestion,
  Film,
  FolderOpen,
  Music,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../../core/mediaInspector';
import { CONVERSION_PRESETS } from '../../core/presets';
import type { QueueItem, RuntimeCapabilities } from '../../types/media';

interface QueueTableProps {
  items: QueueItem[];
  runtime: RuntimeCapabilities;
  outputDirectory: string;
  onChangePreset: (itemId: string, presetId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onCancelItem: (itemId: string) => void;
  onCancelAll: () => void;
  onClearQueue: () => void;
  onAttemptStartQueue: () => void;
  onRevealOutput: (outputPath: string) => void;
  runtimeNotice: string | null;
}

function getKindIcon(kind: QueueItem['kind']) {
  if (kind === 'video') {
    return <Film className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
  }
  if (kind === 'audio') {
    return <Music className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  return <FileQuestion className="w-4 h-4 text-slate-400 shrink-0" />;
}

function getStatusTextClass(status: QueueItem['status']): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    case 'awaiting-desktop-runtime':
    case 'skipped':
      return 'text-amber-600 dark:text-amber-400';
    case 'cancelled':
      return 'text-slate-500 dark:text-slate-400';
    case 'processing':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-slate-600 dark:text-slate-300';
  }
}

export function QueueTable({
  items,
  runtime,
  outputDirectory,
  onChangePreset,
  onRemoveItem,
  onCancelItem,
  onCancelAll,
  onClearQueue,
  onAttemptStartQueue,
  onRevealOutput,
  runtimeNotice,
}: QueueTableProps) {
  const totalBytes = items.reduce((acc, item) => acc + item.sizeBytes, 0);
  const hasProcessing = items.some((item) => item.status === 'processing');
  const hasStartable = items.some(
    (item) =>
      item.status === 'queued' ||
      item.status === 'awaiting-desktop-runtime' ||
      item.status === 'failed' ||
      item.status === 'cancelled',
  );

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] overflow-hidden">
      {/* Queue Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Conversion Queue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {items.length} {items.length === 1 ? 'file' : 'files'} staged ·{' '}
            {formatBytes(totalBytes)} total · Output: {outputDirectory}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {hasProcessing && (
            <button
              type="button"
              onClick={onCancelAll}
              className="px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-500/40 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cancel Active</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearQueue}
            disabled={items.length === 0 || hasProcessing}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap"
          >
            Clear Queue
          </button>

          <button
            type="button"
            onClick={onAttemptStartQueue}
            disabled={!hasStartable || hasProcessing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {runtime.ffmpegDetected ? 'Start Conversion' : 'Stage & Verify Runtime'}
            </span>
          </button>
        </div>
      </div>

      {/* Honest Runtime Notice when FFmpeg backend is not connected or missing */}
      {runtimeNotice && (
        <div
          role="status"
          className="px-5 py-3 border-b border-amber-200 dark:border-amber-500/25 bg-amber-50/70 dark:bg-amber-500/10 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{runtimeNotice}</div>
        </div>
      )}

      {/* Queue Table */}
      {items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No media files in queue
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Drop local video or audio files above to inspect metadata and assign target encoding settings.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pl-5 pr-3">Source File</th>
                <th className="py-2.5 px-3">Streams & Metadata</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
                <th className="py-2.5 px-3 text-right">Size</th>
                <th className="py-2.5 px-3">Target Format</th>
                <th className="py-2.5 px-3">Status & Progress</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80 text-xs">
              {items.map((item) => {
                const resolutionText =
                  item.metadata.width && item.metadata.height
                    ? `${item.metadata.width}x${item.metadata.height}`
                    : item.kind === 'audio'
                      ? 'Audio Only'
                      : 'Unknown';

                const codecParts = [
                  item.metadata.videoCodec?.toUpperCase(),
                  item.metadata.audioCodec?.toUpperCase(),
                  item.metadata.frameRate ? `${item.metadata.frameRate} fps` : null,
                  item.metadata.audioChannels ? `${item.metadata.audioChannels}ch` : null,
                  item.metadata.bitrateKbps ? `${item.metadata.bitrateKbps} kbps` : null,
                ].filter(Boolean);

                const isProcessing = item.status === 'processing';
                const pct = item.progress?.percent;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/35 transition-colors align-top"
                  >
                    <td className="py-3 pl-5 pr-3 max-w-[240px]">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5">{getKindIcon(item.kind)}</div>
                        <div className="min-w-0">
                          <div
                            className="font-medium text-slate-900 dark:text-slate-100 truncate"
                            title={item.fileName}
                          >
                            {item.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {item.metadata.containerFormat ??
                              (item.extension.toUpperCase() || 'FILE')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      <div>{resolutionText}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {codecParts.length > 0
                          ? codecParts.join(' · ')
                          : item.metadata.metadataSource === 'ffprobe'
                            ? 'No extra stream tags'
                            : 'Full codecs via FFprobe'}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatDuration(item.metadata.durationSeconds)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      <div>{formatBytes(item.sizeBytes)}</div>
                      {item.outputSizeBytes !== null && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Out: {formatBytes(item.outputSizeBytes)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <select
                        aria-label={`Target preset for ${item.fileName}`}
                        value={item.presetId}
                        disabled={isProcessing}
                        onChange={(e) => onChangePreset(item.id, e.target.value)}
                        className="h-8 px-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="custom-config">
                          Custom ({item.conversionConfig.container.toUpperCase()} ·{' '}
                          {item.conversionConfig.videoCodec.toUpperCase()} ·{' '}
                          {item.conversionConfig.resolution})
                        </option>
                        {CONVERSION_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        {item.conversionConfig.container.toUpperCase()} ·{' '}
                        {item.conversionConfig.videoCodec.toUpperCase()} ·{' '}
                        {item.conversionConfig.audioCodec.toUpperCase()} ·{' '}
                        {item.conversionConfig.resolution}
                      </div>
                    </td>

                    <td className="py-3 px-3 min-w-[200px]">
                      <div className={`font-medium ${getStatusTextClass(item.status)}`}>
                        {item.statusDetail}
                      </div>

                      {isProcessing && item.progress && (
                        <div className="mt-1.5 space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-150"
                              style={{
                                width:
                                  pct !== null && pct !== undefined
                                    ? `${Math.min(100, Math.max(0, pct))}%`
                                    : '100%',
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            <span>
                              {pct !== null && pct !== undefined ? `${pct.toFixed(1)}%` : 'Running'}
                            </span>
                            <span>
                              Elapsed {formatDuration(item.progress.elapsedSeconds)}
                            </span>
                            {item.progress.etaSeconds !== null && (
                              <span>
                                ETA {formatDuration(item.progress.etaSeconds)}
                              </span>
                            )}
                            {item.progress.outputSizeBytes !== null && (
                              <span>{formatBytes(item.progress.outputSizeBytes)}</span>
                            )}
                            {item.progress.speed && <span>{item.progress.speed}</span>}
                          </div>
                        </div>
                      )}

                      {item.status === 'failed' && item.errorMessage && (
                        <div
                          className="mt-1 text-[11px] text-red-600 dark:text-red-400 line-clamp-2 max-w-[260px]"
                          title={item.errorMessage}
                        >
                          {item.errorMessage}
                        </div>
                      )}

                      {item.status === 'completed' && item.outputPath && (
                        <div
                          className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]"
                          title={item.outputPath}
                        >
                          {item.outputPath}
                        </div>
                      )}
                    </td>

                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {item.status === 'completed' && item.outputPath && (
                          <button
                            type="button"
                            onClick={() => onRevealOutput(item.outputPath!)}
                            title="Show output file in Explorer"
                            aria-label={`Reveal ${item.fileName} output in Explorer`}
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                        )}

                        {isProcessing ? (
                          <button
                            type="button"
                            onClick={() => onCancelItem(item.id)}
                            title="Cancel active FFmpeg job"
                            aria-label={`Cancel conversion for ${item.fileName}`}
                            className="p-1.5 rounded-md text-red-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Remove ${item.fileName} from queue`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
