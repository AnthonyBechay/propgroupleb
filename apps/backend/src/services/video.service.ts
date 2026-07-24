import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Compress an uploaded video with ffmpeg: downscale to ≤720p, re-encode to
 * H.264 + AAC at a web-friendly bitrate, and enable faststart for progressive
 * playback. Phone recordings are frequently 50–200MB at bitrates far higher
 * than a property listing needs; this typically cuts them by 60–85%.
 *
 * Always returns an mp4 buffer + the new content type/extension on success.
 * If ffmpeg is missing, errors, or somehow produces a *larger* file, the
 * original is returned untouched — an upload must never fail because
 * compression didn't apply.
 */
export interface CompressedVideo {
  buffer: Buffer;
  contentType: string;
  ext: string; // e.g. ".mp4"
  changed: boolean;
}

const FFMPEG_ARGS = (input: string, output: string): string[] => [
  '-i', input,
  '-vf', "scale='min(1280,iw)':-2", // cap width at 1280, keep aspect, even height
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '28',
  '-c:a', 'aac',
  '-b:a', '96k',
  '-movflags', '+faststart',
  '-y',
  output,
];

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('ffmpeg timed out')); }, timeoutMs);
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export async function compressVideoBuffer(
  buffer: Buffer,
  originalName: string,
  timeoutMs = 5 * 60 * 1000,
): Promise<CompressedVideo> {
  const fallback: CompressedVideo = {
    buffer,
    contentType: 'video/mp4',
    ext: path.extname(originalName) || '.mp4',
    changed: false,
  };

  const dir = os.tmpdir();
  const id = randomUUID().slice(0, 8);
  const inPath = path.join(dir, `vin-${id}${path.extname(originalName) || '.tmp'}`);
  const outPath = path.join(dir, `vout-${id}.mp4`);

  try {
    await fs.writeFile(inPath, buffer);
    await runFfmpeg(FFMPEG_ARGS(inPath, outPath), timeoutMs);
    const out = await fs.readFile(outPath);
    if (out.length > 0 && out.length < buffer.length) {
      return { buffer: out, contentType: 'video/mp4', ext: '.mp4', changed: true };
    }
    return fallback;
  } catch (err) {
    logger.error('Video compression failed — storing original', err);
    return fallback;
  } finally {
    fs.unlink(inPath).catch(() => {});
    fs.unlink(outPath).catch(() => {});
  }
}
