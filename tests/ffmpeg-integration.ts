import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAndVerifyBinary } from '../electron/services/binaryManager';
import { probeMediaFile } from '../electron/services/ffprobeService';
import { ConversionQueueManager, QueueStatusPayload } from '../electron/services/queueManager';
import { buildSafeOutputPath, validateInputMediaPath } from '../electron/services/pathValidator';

function runRawFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true, shell: false });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf-8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Synthetic fixture ffmpeg failed (${code}): ${stderr}`));
    });
  });
}

async function runTests() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'helal-ffmpeg-test-'));
  const outDir = path.join(tmpDir, 'output');
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Test workspace: ${tmpDir}`);

  try {
    // 1. FFmpeg & FFprobe executable detection
    const ffmpegBin = await resolveAndVerifyBinary('ffmpeg');
    const ffprobeBin = await resolveAndVerifyBinary('ffprobe');
    assert.equal(ffmpegBin.available, true, 'FFmpeg should be detected');
    assert.equal(ffprobeBin.available, true, 'FFprobe should be detected');
    assert.ok(ffmpegBin.version?.includes('ffmpeg version'), 'FFmpeg version string should be valid');
    assert.ok(ffprobeBin.version?.includes('ffprobe version'), 'FFprobe version string should be valid');
    console.log('[PASS] 1. FFmpeg & FFprobe executable detection:', ffmpegBin.version);

    // Generate real 3s 720p test MP4 + 10s test MP4 for cancellation test
    const sampleMp4 = path.join(tmpDir, 'sample_input.mp4');
    await runRawFfmpeg([
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=1280x720:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-ac', '2',
      sampleMp4,
    ]);

    // 2. FFprobe metadata extraction
    const probe = await probeMediaFile(sampleMp4);
    assert.equal(probe.fileName, 'sample_input.mp4');
    assert.ok(probe.containerFormat, 'containerFormat should be populated');
    assert.ok(probe.durationSeconds && probe.durationSeconds >= 1.8, 'durationSeconds should be ~2s');
    assert.ok(probe.sizeBytes && probe.sizeBytes > 1000, 'sizeBytes should be > 1000');
    assert.equal(probe.videoCodec, 'h264');
    assert.equal(probe.audioCodec, 'aac');
    assert.equal(probe.width, 1280);
    assert.equal(probe.height, 720);
    assert.equal(probe.frameRate, 30);
    assert.ok(probe.bitrateKbps && probe.bitrateKbps > 0);
    assert.equal(probe.audioChannels, 2);
    console.log('[PASS] 2. FFprobe metadata extraction:', JSON.stringify(probe));

    // 3. MP4 -> MKV conversion with real-time progress
    const qm = new ConversionQueueManager();
    const statuses1: QueueStatusPayload[] = [];
    let progressEvents1 = 0;

    await new Promise<void>((resolve, reject) => {
      void qm.startQueue(
        {
          jobs: [
            {
              jobId: 'job-mp4-mkv',
              inputPath: sampleMp4,
              fileName: 'sample_input.mp4',
              durationSeconds: probe.durationSeconds,
              config: {
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'flac',
                resolution: 'original',
                qualityPreset: 'medium',
                customCrf: 22,
                customAudioBitrateKbps: 192,
                encoderSpeed: 'veryfast',
              },
            },
          ],
          outputDirectory: outDir,
          hardwareAcceleration: 'cpu',
          maxConcurrentJobs: 1,
          existingFilePolicy: 'rename',
          preserveMetadata: true,
        },
        {
          onProgress: (ev) => {
            if (ev.jobId === 'job-mp4-mkv') progressEvents1++;
          },
          onStatus: (st) => {
            statuses1.push(st);
            if (st.status === 'completed' || st.status === 'failed' || st.status === 'cancelled') {
              if (st.status === 'completed') resolve();
              else reject(new Error(st.errorMessage || st.status));
            }
          },
        },
      );
    });

    const mkvStatus = statuses1.find((s) => s.status === 'completed')!;
    assert.ok(mkvStatus.outputPath?.endsWith('.mkv'));
    assert.ok(mkvStatus.outputSizeBytes && mkvStatus.outputSizeBytes > 1000);
    assert.ok(progressEvents1 > 0, 'Real progress events should be emitted');
    const mkvProbe = await probeMediaFile(mkvStatus.outputPath!);
    assert.equal(mkvProbe.videoCodec, 'h264');
    assert.equal(mkvProbe.audioCodec, 'flac');
    console.log('[PASS] 3. MP4 -> MKV conversion + progress events:', progressEvents1, 'events');

    // 4 & 5 & 6. MKV -> MP4 conversion + Resolution adjustment (480p) + Codec selection (h265 + mp3)
    const statuses2: QueueStatusPayload[] = [];
    await new Promise<void>((resolve, reject) => {
      void qm.startQueue(
        {
          jobs: [
            {
              jobId: 'job-mkv-mp4-480p-hevc',
              inputPath: mkvStatus.outputPath!,
              fileName: path.basename(mkvStatus.outputPath!),
              durationSeconds: mkvProbe.durationSeconds,
              config: {
                container: 'mp4',
                videoCodec: 'h265',
                audioCodec: 'mp3',
                resolution: '480p',
                qualityPreset: 'custom',
                customCrf: 26,
                customAudioBitrateKbps: 128,
                encoderSpeed: 'ultrafast',
              },
            },
          ],
          outputDirectory: outDir,
          hardwareAcceleration: 'cpu',
          maxConcurrentJobs: 1,
          existingFilePolicy: 'rename',
          preserveMetadata: true,
        },
        {
          onProgress: () => {},
          onStatus: (st) => {
            statuses2.push(st);
            if (st.status === 'completed' || st.status === 'failed' || st.status === 'cancelled') {
              if (st.status === 'completed') resolve();
              else reject(new Error(st.errorMessage || st.status));
            }
          },
        },
      );
    });

    const mp4Status = statuses2.find((s) => s.status === 'completed')!;
    const mp4Probe = await probeMediaFile(mp4Status.outputPath!);
    assert.equal(mp4Probe.height, 480, 'Resolution should be scaled to 480p');
    assert.equal(mp4Probe.videoCodec, 'hevc', 'Video codec should be HEVC/H.265');
    assert.equal(mp4Probe.audioCodec, 'mp3', 'Audio codec should be MP3');
    console.log('[PASS] 4, 5, 6. MKV -> MP4 + 480p + H.265/MP3:', mp4Probe.width + 'x' + mp4Probe.height, mp4Probe.videoCodec, mp4Probe.audioCodec);

    // 7. Conversion cancellation on longer clip
    const longMp4 = path.join(tmpDir, 'long_input.mp4');
    await runRawFfmpeg([
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=25:size=1280x720:rate=30',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      longMp4,
    ]);

    const cancelResult = await new Promise<QueueStatusPayload>((resolve) => {
      let cancelTriggered = false;
      void qm.startQueue(
        {
          jobs: [
            {
              jobId: 'job-cancel-test',
              inputPath: longMp4,
              fileName: 'long_input.mp4',
              durationSeconds: 25,
              config: {
                container: 'webm',
                videoCodec: 'vp9',
                audioCodec: 'opus',
                resolution: '720p',
                qualityPreset: 'high',
                customCrf: 24,
                customAudioBitrateKbps: 128,
                encoderSpeed: 'slow',
              },
            },
          ],
          outputDirectory: outDir,
          hardwareAcceleration: 'cpu',
          maxConcurrentJobs: 1,
          existingFilePolicy: 'rename',
          preserveMetadata: false,
        },
        {
          onProgress: () => {
            if (!cancelTriggered) {
              cancelTriggered = true;
              qm.cancelJob('job-cancel-test');
            }
          },
          onStatus: (st) => {
            if (st.status === 'cancelled' || st.status === 'completed' || st.status === 'failed') {
              resolve(st);
            }
          },
        },
      );
    });
    assert.equal(cancelResult.status, 'cancelled', 'Active VP9 job should cancel cleanly');
    console.log('[PASS] 7. Conversion cancellation:', cancelResult.statusDetail);

    // 8 & 9. Error handling, path validation & output isolation under concurrency
    await assert.rejects(
      () => validateInputMediaPath('relative/path.mp4'),
      /absolute filesystem path/,
    );
    const traversalPlan = buildSafeOutputPath('/tmp/../../etc/passwd.mp4', outDir, 'mp4', 'rename');
    assert.ok(traversalPlan.outputPath.startsWith(outDir + path.sep), 'Output must stay inside outDir');

    const badFile = path.join(tmpDir, 'corrupt.mp4');
    await fs.writeFile(badFile, 'not a real video stream');

    const concurrentStatuses = new Map<string, QueueStatusPayload>();
    await new Promise<void>((resolve) => {
      void qm.startQueue(
        {
          jobs: [
            {
              jobId: 'conc-valid-1',
              inputPath: sampleMp4,
              fileName: 'sample_input.mp4',
              durationSeconds: 2,
              config: {
                container: 'mov',
                videoCodec: 'h264',
                audioCodec: 'aac',
                resolution: 'original',
                qualityPreset: 'low',
                customCrf: 28,
                customAudioBitrateKbps: 128,
                encoderSpeed: 'ultrafast',
              },
            },
            {
              jobId: 'conc-invalid-2',
              inputPath: badFile,
              fileName: 'corrupt.mp4',
              durationSeconds: null,
              config: {
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                resolution: 'original',
                qualityPreset: 'low',
                customCrf: 28,
                customAudioBitrateKbps: 128,
                encoderSpeed: 'ultrafast',
              },
            },
          ],
          outputDirectory: outDir,
          hardwareAcceleration: 'cpu',
          maxConcurrentJobs: 2,
          existingFilePolicy: 'rename',
          preserveMetadata: true,
        },
        {
          onProgress: () => {},
          onStatus: (st) => {
            if (st.status === 'completed' || st.status === 'failed' || st.status === 'cancelled') {
              concurrentStatuses.set(st.jobId, st);
              if (concurrentStatuses.size === 2) {
                resolve();
              }
            }
          },
        },
      );
    });

    assert.equal(concurrentStatuses.get('conc-valid-1')?.status, 'completed');
    assert.equal(concurrentStatuses.get('conc-invalid-2')?.status, 'failed');
    console.log('[PASS] 8 & 9. Path validation, error handling, and concurrent failure isolation');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
