import { premultiplyImage, render, toGray, type RGBAImage } from './flow';
import { estimateDepth, estimateGeometry, rigidSurfaces, turnDisplacement, type PairMeasurement } from './turntable';

// Runs off the main thread: estimating motion and warping full-size frames
// takes a moment per pair, and the studio should stay responsive meanwhile.
// Decoding and encoding images happen on the page instead, because
// OffscreenCanvas is missing from older Safari versions; this file only does
// arithmetic on pixel arrays, which works in every browser with workers.

/** Where the turning axis is (as a fraction of the width) and the camera's tilt (sine). */
export interface PairGeometry {
  axis: number;
  tilt: number;
}

/** A pair's geometry plus how well every candidate tilt explains it (see combineGeometry). */
export type GeometryMeasurement = PairMeasurement;

export type InterpolateRequest =
  /** Measure the axis and tilt from one pair (small copies of the photos are enough). */
  | { kind: 'geometry'; a: RGBAImage; b: RGBAImage; angle: number }
  /** Create the frames between two photos at the given times (0–1 exclusive). */
  | { kind: 'frames'; a: RGBAImage; b: RGBAImage; times: number[]; angle: number; geometry: PairGeometry | null };

export type InterpolateMessage =
  | { type: 'geometry'; measurement: GeometryMeasurement }
  /** One of the two motion estimates is done. */
  | { type: 'motion' }
  | { type: 'frame'; index: number; pixels: Uint8ClampedArray }
  | { type: 'done' }
  | { type: 'error'; message: string };

const post = (message: InterpolateMessage, transfer: Transferable[] = []) => self.postMessage(message, { transfer });

self.onmessage = (event: MessageEvent<InterpolateRequest>) => {
  const request = event.data;
  try {
    const grayA = toGray(request.a);
    const grayB = toGray(request.b);
    if (request.kind === 'geometry') {
      const measured = estimateGeometry(grayA, grayB, request.angle);
      post({ type: 'geometry', measurement: { ...measured, axis: (measured.axis + 0.5) / grayA.width } });
      return;
    }
    const { a, b, times, angle } = request;
    const geometry = request.geometry
      ? { axis: request.geometry.axis * grayA.width - 0.5, tilt: request.geometry.tilt }
      : estimateGeometry(grayA, grayB, angle);
    const fromA = rigidSurfaces(estimateDepth(grayA, grayB, angle, geometry));
    post({ type: 'motion' });
    const fromB = rigidSurfaces(estimateDepth(grayB, grayA, -angle, geometry));
    post({ type: 'motion' });
    const pa = premultiplyImage(a);
    const pb = premultiplyImage(b);
    times.forEach((t, index) => {
      const pixels = render(pa, pb, turnDisplacement(fromA, fromB, t), t);
      post({ type: 'frame', index, pixels }, [pixels.buffer]);
    });
    post({ type: 'done' });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
