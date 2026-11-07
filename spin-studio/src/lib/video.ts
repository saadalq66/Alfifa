import { hasOverlay, paintOver, paintUnder, type LoadedScene } from './scene';
import { planVideo, VIDEO_FPS, videoSize } from './videoPlan';

export interface VideoOptions {
  turns: number;
  /** Target size of the shorter side, e.g. 720 or 1080. */
  shortEdge: number;
  /** Auto-rotate speed in photos per second. */
  spinFps: number;
  scene: LoadedScene;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface RenderedVideo {
  blob: Blob;
  /** Without the dot, e.g. "mp4". */
  extension: string;
  width: number;
  height: number;
  duration: number;
}

export class VideoUnsupportedError extends Error {
  override name = 'VideoUnsupportedError';
}

export function canRenderVideo(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

/**
 * Renders the spin into a video file entirely in the browser (WebCodecs).
 * H.264 MP4 is preferred because it plays everywhere, including phone galleries
 * and social apps; browsers that cannot encode H.264 get WebM (VP9/VP8).
 */
export async function renderSpinVideo(sources: Blob[], options: VideoOptions): Promise<RenderedVideo> {
  if (!canRenderVideo() || sources.length === 0) {
    throw new VideoUnsupportedError('This browser cannot create videos.');
  }
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, getFirstEncodableVideoCodec } =
    await import('mediabunny');
  // Bitrate-based rate control behaves the same in every browser. Mediabunny's
  // default for a quality level is quantizer-based, whose scale differs between
  // browser versions and produced near-minimum quality in testing.
  const quality = new Quality({ quality: 'high', preferBitrate: true });

  const first = await createImageBitmap(sources[0]);
  const { width, height } = videoSize(first.width, first.height, options.shortEdge);
  first.close();

  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'vp8'], {
    width,
    height,
    quality,
    frameRate: VIDEO_FPS,
  });
  if (!codec) throw new VideoUnsupportedError(`This browser cannot encode a ${width}×${height} video.`);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const output = new Output({
    format: codec === 'avc' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const track = new CanvasSource(canvas, { codec, quality });
  output.addVideoTrack(track, { frameRate: VIDEO_FPS });

  const plan = planVideo(sources.length, options.spinFps, options.turns);
  const overlay = hasOverlay(options.scene);
  let written = 0;
  try {
    await output.start();
    for (let turn = 0; turn < options.turns; turn++) {
      for (const source of sources) {
        options.signal?.throwIfAborted();
        const image = await createImageBitmap(source);
        // Videos have no transparency, so a transparent background becomes white.
        if (!paintUnder(ctx, options.scene, width, height)) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        const scale = Math.min(width / image.width, height / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
        image.close();
        if (overlay) paintOver(ctx, options.scene, width, height);
        for (let i = 0; i < plan.hold; i++) {
          await track.add(written / VIDEO_FPS, 1 / VIDEO_FPS);
          written++;
          options.onProgress?.(written / plan.totalFrames);
        }
      }
    }
    await output.finalize();
  } catch (error) {
    if (output.state !== 'finalized') await output.cancel().catch(() => undefined);
    throw error;
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('The video encoder produced no data.');
  return {
    blob: new Blob([buffer], { type: output.format.mimeType }),
    extension: output.format.fileExtension.replace(/^\./, ''),
    width,
    height,
    duration: plan.duration,
  };
}
