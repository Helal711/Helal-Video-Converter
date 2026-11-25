import React, { useState } from 'react';
import { AlertCircle, Check, Play, Plus, Square, Terminal } from 'lucide-react';
import {
  AUDIO_CODEC_OPTIONS,
  CONTAINER_OPTIONS,
  DEFAULT_VIDEO_CONVERSION_CONFIG,
  ENCODER_SPEED_OPTIONS,
  getAllowedAudioCodecs,
  getAllowedVideoCodecs,
  normalizeConfigForContainer,
  QUALITY_OPTIONS,
  RESOLUTION_OPTIONS,
  validateConversionCompatibility,
  VIDEO_CODEC_OPTIONS,
} from '../../core/conversionConfig';
import { formatBytes, formatDuration } from '../../core/mediaInspector';
import {
  buildFfmpegCommandPreview,
  CONVERSION_PRESETS,
} from '../../core/presets';
import type {
  AppSettings,
  QueueItem,
  RuntimeCapabilities,
  VideoContainer,
  VideoConversionConfig,
} from '../../types/media';

interface VideoConverterViewProps {
  queue: QueueItem[];
  settings: AppSettings;
  runtime: RuntimeCapabilities;
  runtimeNotice: string | null;
  onApplyPresetToAll: (presetId: string) => void;
  onApplyCustomConfigToAll: (config: VideoConversionConfig) => void;
  onBrowseClick: () => void;
  onStartQueue: () => void;
  onCancelJob: (jobId: string) => void;
  onCancelAll: () => void;
}

export function VideoConverterView({
  queue,
  settings,
  runtime,
  runtimeNotice,
  onApplyPresetToAll,
  onApplyCustomConfigToAll,
  onBrowseClick,
  onStartQueue,
  onCancelJob,
  onCancelAll,
}: VideoConverterViewProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    CONVERSION_PRESETS[0].id,
  );
  const [customConfig, setCustomConfig] = useState<VideoConversionConfig>(
    CONVERSION_PRESETS[0].videoConfig ?? DEFAULT_VIDEO_CONVERSION_CONFIG,
  );
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  const allowedVideoCodecs = getAllowedVideoCodecs(customConfig.container);
  const allowedAudioCodecs = getAllowedAudioCodecs(customConfig.container);
  const compatibilityError = validateConversionCompatibility(customConfig);

  const sampleFileName = queue[0]?.fileName ?? 'sample-footage.mkv';
  const commandPreview = buildFfmpegCommandPreview(
    sampleFileName,
    customConfig,
    settings.defaultOutputDirectory,
    settings.preserveMetadata,
  );

  const hasProcessing = queue.some((item) => item.status === 'processing');
  const hasStartable = queue.some(
    (item) =>
      item.status === 'queued' ||
      item.status === 'awaiting-desktop-runtime' ||
      item.status === 'failed' ||
      item.status === 'cancelled',
  );

  const handleSelectPresetCard = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = CONVERSION_PRESETS.find((p) => p.id === presetId);
    if (preset?.videoConfig) {
      setCustomConfig(preset.videoConfig);
    }
    setAppliedMessage(null);
  };

  const handleContainerChange = (container: VideoContainer) => {
    setSelectedPresetId('custom-config');
    setCustomConfig((prev) =>
      normalizeConfigForContainer({ ...prev, container }),
    );
    setAppliedMessage(null);
  };

  const handleApplyConfigToQueue = () => {
    if (compatibilityError) return;
    if (selectedPresetId !== 'custom-config') {
      onApplyPresetToAll(selectedPresetId);
    } else {
      onApplyCustomConfigToAll(customConfig);
    }
    setAppliedMessage(
      queue.length > 0
        ? `Applied ${customConfig.container.toUpperCase()} (${customConfig.videoCodec.toUpperCase()} / ${customConfig.audioCodec.toUpperCase()} / ${customConfig.resolution}) to ${queue.length} queued file(s).`
        : 'Encoding profile configured. Add source media files to queue.',
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Video Converter
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Transcode local video across MP4, MKV, AVI, MOV, and WebM with custom codecs, scaling, and real-time FFmpeg progress.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBrowseClick}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121926] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Source Files</span>
          </button>

          {hasProcessing ? (
            <button
              type="button"
              onClick={onCancelAll}
              className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cancel Active</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (queue.length > 0 && !compatibilityError) {
                  onApplyCustomConfigToAll(customConfig);
                }
                onStartQueue();
              }}
              disabled={!hasStartable || Boolean(compatibilityError)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {runtime.ffmpegDetected ? 'Convert Queue' : 'Verify Runtime'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Binary / Runtime Status Banner */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] flex items-start gap-3">
        <AlertCircle
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            runtime.ffmpegDetected
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}
        />
        <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {runtimeNotice ? (
            <span>{runtimeNotice}</span>
          ) : runtime.ffmpegDetected ? (
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                FFmpeg Ready ({runtime.ffmpegSource}):{' '}
              </span>
              {runtime.ffmpegVersion}
            </span>
          ) : (
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                Browser Preview Shell:{' '}
              </span>
              Configure presets and inspect exact FFmpeg arguments here. Local transcoding executes via Electron when launched on Windows with FFmpeg installed.
            </span>
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <section className="space-y-2.5">
        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Quick Format Presets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {CONVERSION_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPresetCard(preset.id)}
                className={`text-left p-4 rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/10 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {preset.description}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <span>.{preset.container}</span>
                  <span aria-hidden="true">·</span>
                  <span>{preset.videoCodec}</span>
                  <span aria-hidden="true">·</span>
                  <span>{preset.audioCodec}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Granular Encoding Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Encoding Parameters
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize container, codecs, resolution scaling, and quality profile.
            </p>
          </div>

          <button
            type="button"
            onClick={handleApplyConfigToQueue}
            disabled={Boolean(compatibilityError)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            Apply to Staged Queue ({queue.length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="conv-container"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Container
            </label>
            <select
              id="conv-container"
              value={customConfig.container}
              onChange={(e) => handleContainerChange(e.target.value as VideoContainer)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CONTAINER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="conv-vcodec"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Video Codec
            </label>
            <select
              id="conv-vcodec"
              value={customConfig.videoCodec}
              onChange={(e) => {
                setSelectedPresetId('custom-config');
                setCustomConfig((prev) => ({
                  ...prev,
                  videoCodec: e.target.value as VideoConversionConfig['videoCodec'],
                }));
                setAppliedMessage(null);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {VIDEO_CODEC_OPTIONS.map((opt) => {
                const supported = allowedVideoCodecs.includes(opt.value);
                return (
                  <option key={opt.value} value={opt.value} disabled={!supported}>
                    {opt.label}
                    {!supported ? ' (Not valid for container)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="conv-acodec"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Audio Codec
            </label>
            <select
              id="conv-acodec"
              value={customConfig.audioCodec}
              onChange={(e) => {
                setSelectedPresetId('custom-config');
                setCustomConfig((prev) => ({
                  ...prev,
                  audioCodec: e.target.value as VideoConversionConfig['audioCodec'],
                }));
                setAppliedMessage(null);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AUDIO_CODEC_OPTIONS.map((opt) => {
                const supported = allowedAudioCodecs.includes(opt.value);
                return (
                  <option key={opt.value} value={opt.value} disabled={!supported}>
                    {opt.label}
                    {!supported ? ' (Not valid for container)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="conv-res"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Resolution
            </label>
            <select
              id="conv-res"
              value={customConfig.resolution}
              onChange={(e) => {
                setSelectedPresetId('custom-config');
                setCustomConfig((prev) => ({
                  ...prev,
                  resolution: e.target.value as VideoConversionConfig['resolution'],
                }));
                setAppliedMessage(null);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RESOLUTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="conv-quality"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Quality Preset
            </label>
            <select
              id="conv-quality"
              value={customConfig.qualityPreset}
              onChange={(e) => {
                setSelectedPresetId('custom-config');
                setCustomConfig((prev) => ({
                  ...prev,
                  qualityPreset: e.target.value as VideoConversionConfig['qualityPreset'],
                }));
                setAppliedMessage(null);
              }}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Quality Controls */}
        {customConfig.qualityPreset === 'custom' && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="conv-crf"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                CRF Quality Factor (Lower = Higher Quality)
              </label>
              <input
                id="conv-crf"
                type="number"
                min={0}
                max={customConfig.videoCodec === 'vp9' ? 63 : 51}
                value={customConfig.customCrf}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    customCrf: Number(e.target.value) || 22,
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="conv-abitrate"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Audio Bitrate
              </label>
              <select
                id="conv-abitrate"
                value={customConfig.customAudioBitrateKbps}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    customAudioBitrateKbps: Number(e.target.value),
                  }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={96}>96 kbps</option>
                <option value={128}>128 kbps</option>
                <option value={192}>192 kbps</option>
                <option value={256}>256 kbps</option>
                <option value={320}>320 kbps</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="conv-speed"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Encoder Speed Preset
              </label>
              <select
                id="conv-speed"
                value={customConfig.encoderSpeed}
                onChange={(e) =>
                  setCustomConfig((prev) => ({
                    ...prev,
                    encoderSpeed: e.target.value as VideoConversionConfig['encoderSpeed'],
                  }))
                }
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ENCODER_SPEED_OPTIONS.map((spd) => (
                  <option key={spd} value={spd}>
                    {spd}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {compatibilityError && (
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            {compatibilityError}
          </p>
        )}

        {appliedMessage && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {appliedMessage}
          </p>
        )}
      </section>

      {/* Active Queue Snapshot inside Video Converter */}
      {queue.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Staged Files & Live Progress ({queue.length})
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Max Workers: {settings.maxConcurrentJobs}
            </span>
          </div>
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
            {queue.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.fileName}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {item.metadata.width && item.metadata.height
                      ? `${item.metadata.width}x${item.metadata.height}`
                      : '—'}{' '}
                    · {formatDuration(item.metadata.durationSeconds)} ·{' '}
                    {formatBytes(item.sizeBytes)} →{' '}
                    {item.conversionConfig.container.toUpperCase()} (
                    {item.conversionConfig.videoCodec.toUpperCase()} /{' '}
                    {item.conversionConfig.resolution})
                  </div>
                  {item.status === 'processing' && item.progress && (
                    <div className="mt-2 space-y-1 max-w-md">
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-150"
                          style={{
                            width:
                              item.progress.percent !== null
                                ? `${item.progress.percent}%`
                                : '100%',
                          }}
                        />
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.progress.percent !== null
                          ? `${item.progress.percent.toFixed(1)}%`
                          : 'Running'}{' '}
                        · Elapsed {formatDuration(item.progress.elapsedSeconds)}
                        {item.progress.etaSeconds !== null
                          ? ` · ETA ${formatDuration(item.progress.etaSeconds)}`
                          : ''}
                        {item.progress.outputSizeBytes !== null
                          ? ` · ${formatBytes(item.progress.outputSizeBytes)}`
                          : ''}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {item.statusDetail}
                  </span>
                  {item.status === 'processing' && (
                    <button
                      type="button"
                      onClick={() => onCancelJob(item.id)}
                      className="px-2.5 py-1 rounded-md border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[11px] font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FFmpeg Command Inspector */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121926] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Generated FFmpeg Arguments (Spawn Array Preview)
          </h3>
        </div>

        <div className="p-5">
          <div className="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
            <code>{commandPreview}</code>
          </div>
        </div>
      </section>
    </div>
  );
}
