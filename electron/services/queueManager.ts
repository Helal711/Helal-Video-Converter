import { resolveAndVerifyBinary } from './binaryManager';
import {
  buildValidatedFfmpegArgs,
  HardwareAcceleration,
  validateConversionConfig,
  VideoConversionConfig,
} from './conversionBuilder';
import { cancelFfmpegJob, FfmpegRealProgress, runFfmpegJob } from './ffmpegService';
import { probeMediaFile } from './ffprobeService';
import {
  buildSafeOutputPath,
  ExistingFilePolicy,
  validateInputMediaPath,
  validateOutputDirectory,
} from './pathValidator';

export interface QueueJobInput {
  jobId: string;
  inputPath: string;
  fileName: string;
  config: VideoConversionConfig;
  durationSeconds: number | null;
}

export interface QueueStartRequest {
  jobs: QueueJobInput[];
  outputDirectory: string;
  ffmpegBinaryPath?: string;
  ffprobeBinaryPath?: string;
  hardwareAcceleration: HardwareAcceleration;
  maxConcurrentJobs: number;
  existingFilePolicy: ExistingFilePolicy;
  preserveMetadata: boolean;
}

export interface QueueStatusPayload {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  statusDetail: string;
  outputPath: string | null;
  outputSizeBytes: number | null;
  elapsedSeconds: number | null;
  errorMessage: string | null;
}

export interface QueueProgressPayload {
  jobId: string;
  progress: FfmpegRealProgress;
}

export interface QueueManagerCallbacks {
  onProgress: (payload: QueueProgressPayload) => void;
  onStatus: (payload: QueueStatusPayload) => void;
}

export class ConversionQueueManager {
  private pendingJobs: QueueJobInput[] = [];
  private activeJobIds = new Set<string>();
  private cancelledPendingIds = new Set<string>();
  private isRunning = false;

  async startQueue(
    request: QueueStartRequest,
    callbacks: QueueManagerCallbacks,
  ): Promise<{ started: boolean; error?: string }> {
    if (!request.jobs || request.jobs.length === 0) {
      return { started: false, error: 'No conversion jobs were provided.' };
    }

    const ffmpegBinary = await resolveAndVerifyBinary('ffmpeg', request.ffmpegBinaryPath);
    if (!ffmpegBinary.available || !ffmpegBinary.resolvedPath) {
      return {
        started: false,
        error: ffmpegBinary.error ?? 'FFmpeg executable is missing.',
      };
    }

    let validatedOutputDir: string;
    try {
      validatedOutputDir = await validateOutputDirectory(request.outputDirectory);
    } catch (dirErr) {
      return {
        started: false,
        error: dirErr instanceof Error ? dirErr.message : String(dirErr),
      };
    }

    const concurrency = Math.min(4, Math.max(1, Math.round(request.maxConcurrentJobs || 1)));
    this.cancelledPendingIds.clear();
    this.pendingJobs = [...request.jobs];
    this.isRunning = true;

    const runWorker = async () => {
      while (this.pendingJobs.length > 0) {
        const job = this.pendingJobs.shift();
        if (!job) break;

        if (this.cancelledPendingIds.has(job.jobId)) {
          this.cancelledPendingIds.delete(job.jobId);
          callbacks.onStatus({
            jobId: job.jobId,
            status: 'cancelled',
            statusDetail: 'Cancelled before start',
            outputPath: null,
            outputSizeBytes: null,
            elapsedSeconds: 0,
            errorMessage: null,
          });
          continue;
        }

        this.activeJobIds.add(job.jobId);

        try {
          const validatedInput = await validateInputMediaPath(job.inputPath);
          const validatedConfig = validateConversionConfig(job.config);
          const outputPlan = buildSafeOutputPath(
            validatedInput,
            validatedOutputDir,
            validatedConfig.container,
            request.existingFilePolicy,
          );

          if (outputPlan.action === 'skip' || !outputPlan.overwriteFlag) {
            callbacks.onStatus({
              jobId: job.jobId,
              status: 'skipped',
              statusDetail: 'Skipped (file already exists)',
              outputPath: outputPlan.outputPath,
              outputSizeBytes: null,
              elapsedSeconds: 0,
              errorMessage: null,
            });
            continue;
          }

          callbacks.onStatus({
            jobId: job.jobId,
            status: 'processing',
            statusDetail: 'Probing input streams',
            outputPath: outputPlan.outputPath,
            outputSizeBytes: null,
            elapsedSeconds: 0,
            errorMessage: null,
          });

          const probe = await probeMediaFile(
            validatedInput,
            request.ffprobeBinaryPath,
          ).catch(() => null);

          const durationSeconds = probe?.durationSeconds ?? job.durationSeconds;
          const hasAudioStream = probe ? Boolean(probe.audioCodec) : true;

          const encodingArgs = buildValidatedFfmpegArgs(validatedConfig, {
            preserveMetadata: request.preserveMetadata,
            hardwareAcceleration: request.hardwareAcceleration,
            hasAudioStream,
          });

          callbacks.onStatus({
            jobId: job.jobId,
            status: 'processing',
            statusDetail: 'Transcoding',
            outputPath: outputPlan.outputPath,
            outputSizeBytes: null,
            elapsedSeconds: 0,
            errorMessage: null,
          });

          const result = await runFfmpegJob(
            {
              jobId: job.jobId,
              inputPath: validatedInput,
              executablePath: ffmpegBinary.resolvedPath!,
              outputPath: outputPlan.outputPath,
              overwriteFlag: outputPlan.overwriteFlag,
              encodingArgs,
              durationSeconds,
            },
            (progress) => {
              callbacks.onProgress({ jobId: job.jobId, progress });
            },
          );

          if (result.status === 'completed') {
            callbacks.onStatus({
              jobId: job.jobId,
              status: 'completed',
              statusDetail: 'Completed',
              outputPath: result.outputPath,
              outputSizeBytes: result.outputSizeBytes,
              elapsedSeconds: result.elapsedSeconds,
              errorMessage: null,
            });
          } else if (result.status === 'cancelled') {
            callbacks.onStatus({
              jobId: job.jobId,
              status: 'cancelled',
              statusDetail: 'Cancelled',
              outputPath: null,
              outputSizeBytes: null,
              elapsedSeconds: result.elapsedSeconds,
              errorMessage: null,
            });
          } else {
            callbacks.onStatus({
              jobId: job.jobId,
              status: 'failed',
              statusDetail: 'Failed',
              outputPath: null,
              outputSizeBytes: null,
              elapsedSeconds: result.elapsedSeconds,
              errorMessage: result.error ?? 'FFmpeg conversion failed.',
            });
          }
        } catch (err) {
          callbacks.onStatus({
            jobId: job.jobId,
            status: 'failed',
            statusDetail: 'Failed',
            outputPath: null,
            outputSizeBytes: null,
            elapsedSeconds: 0,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        } finally {
          this.activeJobIds.delete(job.jobId);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, this.pendingJobs.length) }, () =>
      runWorker(),
    );

    void Promise.all(workers).finally(() => {
      this.isRunning = false;
    });

    return { started: true };
  }

  cancelJob(jobId: string): boolean {
    if (this.activeJobIds.has(jobId)) {
      return cancelFfmpegJob(jobId);
    }
    const idx = this.pendingJobs.findIndex((j) => j.jobId === jobId);
    if (idx !== -1) {
      this.cancelledPendingIds.add(jobId);
      return true;
    }
    return false;
  }

  cancelAll(): number {
    let count = 0;
    for (const pending of this.pendingJobs) {
      this.cancelledPendingIds.add(pending.jobId);
      count++;
    }
    for (const activeId of this.activeJobIds) {
      if (cancelFfmpegJob(activeId)) {
        count++;
      }
    }
    return count;
  }

  getStatusSnapshot() {
    return {
      isRunning: this.isRunning,
      activeCount: this.activeJobIds.size,
      pendingCount: this.pendingJobs.length,
    };
  }
}
