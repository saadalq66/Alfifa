import { estimateFlow, synthesize, toGray, type RGBAImage } from './flow';

// Runs off the main thread: estimating motion and warping full-size frames
// takes a moment per pair, and the studio should stay responsive meanwhile.

export interface InterpolateRequest {
  id: number;
  a: Blob;
  b: Blob;
  times: number[];
  format: 'image/png' | 'image/jpeg';
}

export type InterpolateResponse =
  | { id: number; ok: true; frames: Blob[] }
  | { id: number; ok: false; message: string };

self.onmessage = async (event: MessageEvent<InterpolateRequest>) => {
  const { id, a, b, times, format } = event.data;
  try {
    const imageA = await decode(a);
    const imageB = await decode(b, imageA.width, imageA.height);
    const grayA = toGray(imageA);
    const grayB = toGray(imageB);
    const flowAB = estimateFlow(grayA, grayB);
    const flowBA = estimateFlow(grayB, grayA);
    const canvas = new OffscreenCanvas(imageA.width, imageA.height);
    const ctx = canvas.getContext('2d')!;
    const frames: Blob[] = [];
    for (const t of times) {
      const pixels = synthesize(imageA, imageB, flowAB, flowBA, t);
      ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, imageA.width, imageA.height), 0, 0);
      frames.push(await canvas.convertToBlob({ type: format, quality: 0.92 }));
    }
    self.postMessage({ id, ok: true, frames } satisfies InterpolateResponse);
  } catch (error) {
    self.postMessage({ id, ok: false, message: error instanceof Error ? error.message : String(error) } satisfies InterpolateResponse);
  }
};

/** Decodes to RGBA pixels, resized to the first photo's size when they differ. */
async function decode(blob: Blob, width?: number, height?: number): Promise<RGBAImage> {
  const bitmap = await createImageBitmap(blob);
  const w = width ?? bitmap.width;
  const h = height ?? bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}
