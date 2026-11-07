import { describe, expect, it } from 'vitest';
import { estimateFlow, projectFlow, synthesize, toGray, type RGBAImage } from './flow';

const W = 200;
const H = 150;

/** A textured block on a plain background, offset horizontally by `shift` pixels. */
function scene(shift: number, transparent = false): RGBAImage {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const bx = x - 60 - shift;
      const inside = bx >= 0 && bx < 60 && y >= 40 && y < 110;
      if (inside) {
        // Deterministic texture that moves with the block.
        const v = ((bx * 37 + y * 91) ^ (bx * y)) & 255;
        data[i] = v;
        data[i + 1] = 255 - v;
        data[i + 2] = (v * 3) & 255;
        data[i + 3] = 255;
      } else {
        data[i] = data[i + 1] = data[i + 2] = 230;
        data[i + 3] = transparent ? 0 : 255;
      }
    }
  }
  return { width: W, height: H, data };
}

function meanAbsError(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]);
  return sum / ((a.length / 4) * 3);
}

function crossfade(a: Uint8ClampedArray, b: Uint8ClampedArray, t: number) {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}

describe('estimateFlow', () => {
  it('finds the motion of a textured object and keeps the background still', () => {
    const a = scene(0);
    const b = scene(16);
    const flow = estimateFlow(toGray(a, W), toGray(b, W));
    const at = (x: number, y: number) => [flow.u[y * flow.width + x], flow.v[y * flow.width + x]];
    const [u, v] = at(90, 75);
    expect(u).toBeGreaterThan(14);
    expect(u).toBeLessThan(18);
    expect(Math.abs(v)).toBeLessThan(1.5);
    const [bu, bv] = at(10, 10);
    expect(Math.abs(bu)).toBeLessThan(1);
    expect(Math.abs(bv)).toBeLessThan(1);
  });
});

describe('projectFlow', () => {
  it('marks areas no pixel moves into as hidden', () => {
    const flow = {
      width: 4,
      height: 1,
      u: new Float32Array([2, 2, 0, 0]),
      v: new Float32Array(4),
    };
    const projected = projectFlow(flow, 1);
    // Coverage is lightly smoothed, so "hidden" means far below the rest.
    expect(projected.weight[0]).toBeLessThan(0.5);
    expect(projected.weight[2]).toBeGreaterThan(1);
  });
});

describe('synthesize', () => {
  it('places the object in between, far closer to the truth than a cross-fade', () => {
    const a = scene(0);
    const b = scene(16);
    const truth = scene(8);
    const flowAB = estimateFlow(toGray(a, W), toGray(b, W));
    const flowBA = estimateFlow(toGray(b, W), toGray(a, W));
    const mid = synthesize(a, b, flowAB, flowBA, 0.5);
    const errFlow = meanAbsError(mid, truth.data);
    const errFade = meanAbsError(crossfade(a.data, b.data, 0.5), truth.data);
    expect(errFlow).toBeLessThan(errFade * 0.5);
  });

  it('keeps transparency for cut-outs', () => {
    const a = scene(0, true);
    const b = scene(16, true);
    const flowAB = estimateFlow(toGray(a, W), toGray(b, W));
    const flowBA = estimateFlow(toGray(b, W), toGray(a, W));
    const mid = synthesize(a, b, flowAB, flowBA, 0.5);
    expect(mid[(10 * W + 10) * 4 + 3]).toBe(0);
    expect(mid[(75 * W + 98) * 4 + 3]).toBe(255);
  });
});
