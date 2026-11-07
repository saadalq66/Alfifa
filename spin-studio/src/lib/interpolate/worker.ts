import { estimateFlow, premultiplyImage, synthesize, toGray, type RGBAImage } from './flow';

// Runs off the main thread: estimating motion and warping full-size frames
// takes a moment per pair, and the studio should stay responsive meanwhile.
// Decoding and encoding images happen on the page instead, because
// OffscreenCanvas is missing from older Safari versions; this file only does
// arithmetic on pixel arrays, which works in every browser with workers.

export interface InterpolateRequest {
  a: RGBAImage;
  /** Same size as `a`. */
  b: RGBAImage;
  /** In-between times, 0–1 exclusive. */
  times: number[];
}

export type InterpolateMessage =
  /** One of the two motion estimates is done. */
  | { type: 'flow' }
  | { type: 'frame'; index: number; pixels: Uint8ClampedArray }
  | { type: 'done' }
  | { type: 'error'; message: string };

const post = (message: InterpolateMessage, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

self.onmessage = (event: MessageEvent<InterpolateRequest>) => {
  const { a, b, times } = event.data;
  try {
    const grayA = toGray(a);
    const grayB = toGray(b);
    const flowAB = estimateFlow(grayA, grayB);
    post({ type: 'flow' });
    const flowBA = estimateFlow(grayB, grayA);
    post({ type: 'flow' });
    const pa = premultiplyImage(a);
    const pb = premultiplyImage(b);
    times.forEach((t, index) => {
      const pixels = synthesize(pa, pb, flowAB, flowBA, t);
      post({ type: 'frame', index, pixels }, [pixels.buffer]);
    });
    post({ type: 'done' });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
