import { canvasToBlob, drawToCanvas, fitWithin, loadBlobImage, supportsWebpEncoding } from '../image';
import { FLOW_SIZE, type RGBAImage } from './flow';
import type { GeometryMeasurement, InterpolateMessage, InterpolateRequest, PairGeometry } from './worker';

export type { GeometryMeasurement, PairGeometry } from './worker';

export interface InterpolatedFrames {
  frames: Blob[];
  /** Small previews of the frames, for the frame strip. */
  thumbs: Blob[];
}

export interface JobOptions {
  /** Asked when the job reaches the front of the queue; false skips it. */
  shouldRun?: () => boolean;
}

export interface InterpolateOptions extends JobOptions {
  /** Turn between the two photos, in radians. */
  angle: number;
  /** Axis and tilt agreed for the whole sequence; measured from this pair when missing. */
  geometry?: PairGeometry | null;
  /** Called with 0–1 as this pair's frames are created. */
  onProgress?: (fraction: number) => void;
}

/** Rejection reason for a queued job that was no longer needed when its turn came. */
export class SkippedError extends Error {
  constructor() {
    super('No longer needed.');
    this.name = 'SkippedError';
  }
}

/** A worker that reports nothing for this long is assumed stuck (e.g. killed for memory). */
const STALL_MS = 90_000;
const THUMB_EDGE = 200;

type Job = { a: Blob; b: Blob; reject: (error: Error) => void } & (
  | ({ kind: 'geometry'; angle: number; resolve: (result: GeometryMeasurement) => void } & JobOptions)
  | ({ kind: 'frames'; times: number[]; resolve: (result: InterpolatedFrames) => void } & InterpolateOptions)
);

const queue: Job[] = [];
const idle: Worker[] = [];
let running = 0;
// Set after a worker stalls: memory is probably tight, so run one pair at a time.
let lowMemory = false;

/**
 * Pairs run in parallel on a small pool of workers: two halves the wait on
 * multi-core phones and laptops without holding many full-size images in
 * memory at once.
 */
function poolSize(): number {
  if (lowMemory) return 1;
  return Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
}

/** Measures the turning axis and camera tilt from one pair of photos. Jobs are queued. */
export function measureGeometry(
  a: Blob,
  b: Blob,
  angle: number,
  options: JobOptions = {},
): Promise<GeometryMeasurement> {
  return new Promise((resolve, reject) => {
    queue.push({ kind: 'geometry', a, b, angle, ...options, resolve, reject });
    pump();
  });
}

/** Creates the frames between two photos at the given times (0–1). Jobs are queued. */
export function interpolatePair(
  a: Blob,
  b: Blob,
  times: number[],
  options: InterpolateOptions,
): Promise<InterpolatedFrames> {
  return new Promise((resolve, reject) => {
    queue.push({ kind: 'frames', a, b, times, ...options, resolve, reject });
    pump();
  });
}

function pump() {
  while (queue.length > 0 && running < poolSize()) {
    const job = queue.shift()!;
    if (job.shouldRun && !job.shouldRun()) {
      job.reject(new SkippedError());
      continue;
    }
    running++;
    run(job)
      .then(
        (result) => (job.resolve as (value: unknown) => void)(result),
        (error: unknown) => job.reject(error instanceof Error ? error : new Error(String(error))),
      )
      .finally(() => {
        running--;
        // Next task, so callers react to this result (e.g. stop wanting the
        // rest of the queue after a failure) before another job starts.
        setTimeout(pump, 0);
      });
  }
}

async function run(job: Job): Promise<GeometryMeasurement | InterpolatedFrames> {
  // Geometry is measured on small copies; frames need the full photos.
  const maxEdge = job.kind === 'geometry' ? FLOW_SIZE : undefined;
  const a = await decode(job.a, undefined, undefined, maxEdge);
  const b = await decode(job.b, a.width, a.height);
  // Cut-outs need transparency; photos are smaller as JPEG.
  const alpha = job.a.type === 'image/png' || job.b.type === 'image/png';
  const worker = idle.pop() ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const steps = job.kind === 'frames' ? 2 + job.times.length : 1;
  let done = 0;
  const step = () => {
    done++;
    if (job.kind === 'frames') job.onProgress?.(done / steps);
  };

  return new Promise((resolve, reject) => {
    const frames: Blob[] = [];
    const thumbs: Blob[] = [];
    let measurement: GeometryMeasurement | null = null;
    let encoding = Promise.resolve();
    let encodeError: unknown = null;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (error: unknown, keepWorker: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (keepWorker) idle.push(worker);
      else worker.terminate();
      if (error) reject(error instanceof Error ? error : new Error(String(error)));
      else resolve(measurement ?? { frames, thumbs });
    };
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lowMemory = true;
        settle(new Error('Creating frames stopped responding — the device may be low on memory.'), false);
      }, STALL_MS);
    };

    worker.onmessage = (event: MessageEvent<InterpolateMessage>) => {
      const message = event.data;
      watch();
      switch (message.type) {
        case 'geometry':
          measurement = message.measurement;
          settle(null, true);
          break;
        case 'motion':
          step();
          break;
        case 'frame': {
          const { index, pixels } = message;
          encoding = encoding.then(async () => {
            if (encodeError || settled) return;
            try {
              [frames[index], thumbs[index]] = await encode(pixels, a.width, a.height, alpha);
              step();
            } catch (error) {
              encodeError = error;
            }
          });
          break;
        }
        case 'done':
          clearTimeout(timer);
          void encoding.then(() => settle(encodeError, true));
          break;
        case 'error':
          settle(new Error(message.message), true);
          break;
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      settle(new Error(event.message || 'The frame generator could not start in this browser.'), false);
    };

    watch();
    const request: InterpolateRequest =
      job.kind === 'geometry'
        ? { kind: 'geometry', a, b, angle: job.angle }
        : { kind: 'frames', a, b, times: job.times, angle: job.angle, geometry: job.geometry ?? null };
    worker.postMessage(request, [a.data.buffer as ArrayBuffer, b.data.buffer as ArrayBuffer]);
  });
}

/** Decodes to straight RGBA pixels, at the given size or fitted within `maxEdge`. */
async function decode(blob: Blob, width?: number, height?: number, maxEdge?: number): Promise<RGBAImage> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(blob);
  } catch {
    source = await loadBlobImage(blob);
  }
  const natural = {
    width: source instanceof HTMLImageElement ? source.naturalWidth : source.width,
    height: source instanceof HTMLImageElement ? source.naturalHeight : source.height,
  };
  const fitted = maxEdge ? fitWithin(natural.width, natural.height, maxEdge) : natural;
  const w = width ?? fitted.width;
  const h = height ?? fitted.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
  } finally {
    if ('close' in source) source.close();
    release(canvas);
  }
}

async function encode(pixels: Uint8ClampedArray, width: number, height: number, alpha: boolean): Promise<[Blob, Blob]> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let small: HTMLCanvasElement | undefined;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
    const size = fitWithin(width, height, THUMB_EDGE);
    small = drawToCanvas(canvas, size.width, size.height);
    const thumbType = !alpha ? 'image/jpeg' : (await supportsWebpEncoding()) ? 'image/webp' : 'image/png';
    return await Promise.all([
      canvasToBlob(canvas, alpha ? 'image/png' : 'image/jpeg', 0.92),
      canvasToBlob(small, thumbType, 0.82),
    ]);
  } finally {
    release(canvas);
    if (small) release(small);
  }
}

/** Frees a canvas's memory right away (Safari caps the total, and GC is lazy). */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}
