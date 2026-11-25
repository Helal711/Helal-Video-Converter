import React, { useState } from 'react';
import { FileVideo, UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  onBrowseClick: () => void;
  compact?: boolean;
  isInspecting?: boolean;
}

export function DropZone({
  onFilesDropped,
  onBrowseClick,
  compact = false,
  isInspecting = false,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesDropped(droppedFiles);
    }
  };

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-xl border border-dashed transition-colors duration-150 ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#121926]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <UploadCloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {isInspecting
                ? 'Inspecting local media headers...'
                : 'Drop additional video or audio files to stage in queue'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Supports MP4, MKV, MOV, AVI, WebM, MP3, FLAC, WAV · Local inspection only
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBrowseClick}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Browse Local Files
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border-2 border-dashed p-8 md:p-10 text-center transition-colors duration-150 ${
        isDragging
          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-500/10'
          : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#121926]'
      }`}
    >
      <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 flex items-center justify-center mb-4">
        <FileVideo className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
        {isDragging ? 'Release to add files to queue' : 'Drag and drop media files here'}
      </h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
        Inspect real local file duration, resolution, and byte size immediately. No files are uploaded to any cloud server.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onBrowseClick}
          disabled={isInspecting}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isInspecting ? 'Inspecting Files...' : 'Select Local Media'}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        MP4 · MKV · MOV · WebM · AVI · WMV · MP3 · FLAC · WAV · AAC
      </p>
    </div>
  );
}
