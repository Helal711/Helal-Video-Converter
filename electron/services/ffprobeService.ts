import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveAndVerifyBinary } from './binaryManager';
import { validateInputMediaPath } from './pathValidator';

export interface ProbeStreamInfo {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  channels?: number;
  channel_layout?: string;
}

export interface ProbeFormatInfo {
  format_name?: string;
  format_long_name?: string;
  duration?: string;
  bit_rate?: string;
  size?: string;
}

export interface ProbeOutput {
  streams?: ProbeStreamInfo[];
  format?: ProbeFormatInfo;
}

export interface NormalizedMediaProbe {
  fileName: string;
  containerFormat: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  frameRate: number | null;
  bitrateKbps: number | null;
  audioChannels: number | null;
  audioChannelLayout: string | null;
  metadataSource: 'ffprobe';
}

function parseFrameRate(avg?: string, raw?: string): number | null {
  const candidate = avg && avg !== '0/0' ? avg : raw;
  if (!candidate || !candidate.includes('/')) return null;
  const [numStr, denStr] = candidate.split('/');
  const num = Number(numStr);
  const den = Number(denStr);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return null;
  }
  const value = Math.round((num / den) * 100) / 100;
  return value > 0 ? value : null;
}

export async function probeMediaFile(
  rawFilePath: string,
  configuredBinaryPath?: string,
): Promise<NormalizedMediaProbe> {
  const validatedPath = await validateInputMediaPath(rawFilePath);
  const binary = await resolveAndVerifyBinary('ffprobe', configuredBinaryPath);

  if (!binary.available || !binary.resolvedPath) {
    throw new Error(binary.error ?? 'FFprobe executable is not available.');
  }

  const fileStat = await fs.stat(validatedPath);
  const executable = binary.resolvedPath;

  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      validatedPath,
    ];

    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // Ignore kill error
      }
      reject(new Error('FFprobe inspection timed out after 15 seconds.'));
    }, 15000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf-8')).slice(-2000);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to invoke ffprobe (${executable}): ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr.trim() || 'Invalid media stream'}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as ProbeOutput;
        const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
        const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');

        const durationRaw = parsed.format?.duration ? Number(parsed.format.duration) : NaN;
        const bitrateRaw = parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : NaN;
        const sizeRaw = parsed.format?.size ? Number(parsed.format.size) : fileStat.size;

        const containerFormat =
          parsed.format?.format_long_name ??
          parsed.format?.format_name?.toUpperCase() ??
          null;

        resolve({
          fileName: path.basename(validatedPath),
          containerFormat,
          durationSeconds: Number.isFinite(durationRaw) ? durationRaw : null,
          sizeBytes: Number.isFinite(sizeRaw) ? sizeRaw : fileStat.size,
          width: typeof videoStream?.width === 'number' ? videoStream.width : null,
          height: typeof videoStream?.height === 'number' ? videoStream.height : null,
          videoCodec: videoStream?.codec_name ?? null,
          audioCodec: audioStream?.codec_name ?? null,
          frameRate: parseFrameRate(videoStream?.avg_frame_rate, videoStream?.r_frame_rate),
          bitrateKbps: Number.isFinite(bitrateRaw) ? Math.round(bitrateRaw / 1000) : null,
          audioChannels: typeof audioStream?.channels === 'number' ? audioStream.channels : null,
          audioChannelLayout: audioStream?.channel_layout ?? null,
          metadataSource: 'ffprobe',
        });
      } catch (parseErr) {
        reject(
          new Error(
            `Unable to parse ffprobe JSON output: ${
              parseErr instanceof Error ? parseErr.message : String(parseErr)
            }`,
          ),
        );
      }
    });
  });
}
