import { MAX_FRAME_EDGE } from '../config';
import { canvasToBlob, fitWithin } from './image';

/** Containers browsers commonly play. Files are also recognised by extension, since `type` is often empty. */
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm)$/i;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSION.test(file.name);
}

/**
 * Evenly spaced capture times across [start, end). The end itself is left out:
 * for a full turn it shows the same view as the start, which would otherwise
 * appear twice and make the loop hitch.
 */
export function frameTimes(start: number, end: number, count: number): number[] {
  const span = Math.max(0, end - start);
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => start + (span * i) / n);
}

interface ExtractOptions {
  start: number;
  end: number;
  count: number;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
}

/**
 * Captures frames by seeking a loaded <video>. Seeking (rather than WebCodecs
 * decoding) works with every format the browser can play, including iPhone
 * HEVC videos in Safari, and respects the video's rotation metadata.
 */
export async function extractVideoFrames(video: HTMLVideoElement, options: ExtractOptions): Promise<Blob[]> {
  video.pause();
  const { width, height } = fitWithin(video.videoWidth, video.videoHeight, MAX_FRAME_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const times = frameTimes(options.start, options.end, options.count);
  const blobs: Blob[] = [];
  for (const [i, time] of times.entries()) {
    options.signal?.throwIfAborted();
    await seek(video, time);
    ctx.drawImage(video, 0, 0, width, height);
    blobs.push(await canvasToBlob(canvas, 'image/jpeg', 0.95));
    options.onProgress?.((i + 1) / times.length);
  }
  return blobs;
}

/** Seeks and resolves once the new frame can be drawn. */
export function seek(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));
  // Some browsers report `seeked` before the new frame is ready to draw; where
  // supported, also wait for that frame to be presented (with a time limit, as
  // a paused, unchanged video presents nothing new).
  const presented =
    typeof video.requestVideoFrameCallback === 'function'
      ? new Promise<void>((resolve) => video.requestVideoFrameCallback(() => resolve()))
      : Promise.resolve();
  const seeked = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('The video could not be read.'));
    };
    const timer = setTimeout(done, 5000);
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    video.currentTime = target;
  });
  return seeked.then(() => Promise.race([presented, delay(250)]));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
