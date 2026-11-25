import { ChildProcess, spawn } from 'child_process';
import { promises as fs } from 'fs';

export interface FfmpegExecutionRequest {
  jobId: string;
  executablePath: string;
  inputPath: string;
  outputPath: string;
  overwriteFlag: '-y' | '-n';
  encodingArgs: string[];
  durationSeconds: number | null;
}

export interface FfmpegRealProgress {
  percent: number | null;
  elapsedSeconds: number;
  etaSeconds: number | null;
  speed: string | null;
  outputSizeBytes: number | null;
  outTimeSeconds: number;
  currentStage: string;
}

export interface FfmpegExecutionResult {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  outputPath: string;
  outputSizeBytes: number | null;
  elapsedSeconds: number;
  error?: string;
}

interface ActiveJobHandle {
  process: ChildProcess;
  cancelled: boolean;
  outputPath: string;
  overwriteFlag: '-y' | '-n';
}

const activeProcesses = new Map<string, ActiveJobHandle>();

function parseNumeric(raw: string): number | null {
  if (!raw || raw === 'N/A') return null;
  const num = Number(raw.trim());
  return Number.isFinite(num) ? num : null;
}

export function runFfmpegJob(
  request: FfmpegExecutionRequest,
  onProgress: (progress: FfmpegRealProgress) => void,
): Promise<FfmpegExecutionResult> {
  const startedAtMs = Date.now();

  return new Promise((resolve) => {
    const finalArgs = [
      '-hide_banner',
      '-nostats',
      request.overwriteFlag,
      '-progress',
      'pipe:1',
      '-i',
      request.inputPath,
      ...request.encodingArgs,
      request.outputPath,
    ];

    let child: ChildProcess;
    try {
      child = spawn(request.executablePath, finalArgs, {
        windowsHide: true,
        shell: false,
      });
    } catch (spawnErr) {
      resolve({
        jobId: request.jobId,
        status: 'failed',
        outputPath: request.outputPath,
        outputSizeBytes: null,
        elapsedSeconds: 0,
        error: `Unable to start FFmpeg: ${
          spawnErr instanceof Error ? spawnErr.message : String(spawnErr)
        }`,
      });
      return;
    }

    const handle: ActiveJobHandle = {
      process: child,
      cancelled: false,
      outputPath: request.outputPath,
      overwriteFlag: request.overwriteFlag,
    };
    activeProcesses.set(request.jobId, handle);

    let stdoutBuffer = '';
    let stderrTail = '';
    let currentSpeed: string | null = null;
    let currentTotalSize: number | null = null;
    let currentOutTimeUs = 0;
    let settled = false;

    const emitSnapshot = (stage: string) => {
      const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);
      const outTimeSeconds = Math.max(0, currentOutTimeUs / 1_000_000);
      const duration = request.durationSeconds;

      let percent: number | null = null;
      let etaSeconds: number | null = null;

      if (duration && duration > 0) {
        percent = Math.min(100, Math.max(0, (outTimeSeconds / duration) * 100));
        if (percent >= 1 && percent < 100 && elapsedSeconds >= 0.5) {
          etaSeconds = Math.max(0, (elapsedSeconds * (100 - percent)) / percent);
        }
      }

      onProgress({
        percent,
        elapsedSeconds,
        etaSeconds,
        speed: currentSpeed,
        outputSizeBytes: currentTotalSize,
        outTimeSeconds,
        currentStage: stage,
      });
    };

    const processProgressLine = (line: string) => {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();

      if (key === 'speed') {
        currentSpeed = value === 'N/A' ? null : value;
      } else if (key === 'total_size') {
        const parsedSize = parseNumeric(value);
        if (parsedSize !== null && parsedSize >= 0) {
          currentTotalSize = parsedSize;
        }
      } else if (key === 'out_time_us' || key === 'out_time_ms') {
        // FFmpeg outputs out_time_us in microseconds; some builds also emit out_time_ms in microseconds
        if (key === 'out_time_us') {
          const parsedUs = parseNumeric(value);
          if (parsedUs !== null && parsedUs >= 0) {
            currentOutTimeUs = parsedUs;
          }
        }
      } else if (key === 'progress') {
        emitSnapshot(value === 'end' ? 'Finalizing output' : 'Transcoding');
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          processProgressLine(line);
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf-8')).slice(-4000);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      activeProcesses.delete(request.jobId);
      const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);
      resolve({
        jobId: request.jobId,
        status: handle.cancelled ? 'cancelled' : 'failed',
        outputPath: request.outputPath,
        outputSizeBytes: null,
        elapsedSeconds,
        error: `FFmpeg process error: ${err.message}`,
      });
    });

    child.on('close', async (code) => {
      if (settled) return;
      settled = true;

      if (stdoutBuffer.trim()) {
        processProgressLine(stdoutBuffer);
      }

      const wasCancelled = handle.cancelled;
      activeProcesses.delete(request.jobId);
      const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);

      if (wasCancelled) {
        // Clean up partial output file created during cancelled run
        if (request.overwriteFlag === '-n') {
          await fs.unlink(request.outputPath).catch(() => undefined);
        }
        resolve({
          jobId: request.jobId,
          status: 'cancelled',
          outputPath: request.outputPath,
          outputSizeBytes: null,
          elapsedSeconds,
        });
        return;
      }

      if (code === 0) {
        const stat = await fs.stat(request.outputPath).catch(() => null);
        if (!stat || !stat.isFile() || stat.size <= 0) {
          resolve({
            jobId: request.jobId,
            status: 'failed',
            outputPath: request.outputPath,
            outputSizeBytes: null,
            elapsedSeconds,
            error: 'FFmpeg exited with code 0, but the output file is missing or empty.',
          });
          return;
        }

        onProgress({
          percent: 100,
          elapsedSeconds,
          etaSeconds: 0,
          speed: currentSpeed,
          outputSizeBytes: stat.size,
          outTimeSeconds: request.durationSeconds ?? currentOutTimeUs / 1_000_000,
          currentStage: 'Completed',
        });

        resolve({
          jobId: request.jobId,
          status: 'completed',
          outputPath: request.outputPath,
          outputSizeBytes: stat.size,
          elapsedSeconds,
        });
      } else {
        // Remove empty/corrupt output on failed -n run
        if (request.overwriteFlag === '-n') {
          await fs.unlink(request.outputPath).catch(() => undefined);
        }
        const trimmedError = stderrTail.trim();
        resolve({
          jobId: request.jobId,
          status: 'failed',
          outputPath: request.outputPath,
          outputSizeBytes: null,
          elapsedSeconds,
          error: trimmedError || `FFmpeg exited with status code ${code}`,
        });
      }
    });
  });
}

export function cancelFfmpegJob(jobId: string): boolean {
  const handle = activeProcesses.get(jobId);
  if (!handle) return false;

  handle.cancelled = true;
  try {
    // Send 'q' on stdin first if pipe is open, plus SIGTERM for reliable exit
    handle.process.kill('SIGTERM');
    setTimeout(() => {
      if (activeProcesses.has(jobId)) {
        try {
          handle.process.kill('SIGKILL');
        } catch {
          // Process already exited
        }
      }
    }, 2000);
  } catch {
    // Process already exited
  }
  return true;
}

export function getActiveFfmpegJobCount(): number {
  return activeProcesses.size;
}
