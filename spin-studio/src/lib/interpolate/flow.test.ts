import { describe, expect, it } from 'vitest';
import { premultiplyImage, project, render, type Displacement, type RGBAImage } from './flow';

const W = 120;
const H = 90;

/** A textured block on a plain background, offset horizontally by `shift` pixels. */
function scene(shift: number, transparent = false): RGBAImage {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const bx = x - 30 - shift;
      if (bx >= 0 && bx < 40 && y >= 20 && y < 70) {
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

/** The block moves by `shift` pixels from a to b; everything else stays. */
function blockMotion(shift: number, t: number): Displacement {
  const n = W * H;
  const motion: Displacement = {
    width: W,
    height: H,
    duA: new Float32Array(n),
    dvA: new Float32Array(n),
    duB: new Float32Array(n),
    dvB: new Float32Array(n),
  };
  for (let y = 20; y < 70; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 30 && x < 70) motion.duA[y * W + x] = shift * t;
      if (x >= 30 + shift && x < 70 + shift) motion.duB[y * W + x] = -shift * (1 - t);
    }
  }
  return motion;
}

function meanAbsError(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]);
  return sum / ((a.length / 4) * 3);
}

describe('project', () => {
  it('marks areas no pixel moves into as hidden', () => {
    const projected = project(new Float32Array([2, 2, 0, 0]), new Float32Array(4), 4, 1);
    // Coverage is lightly smoothed, so "hidden" means far below the rest.
    expect(projected.weight[0]).toBeLessThan(0.5);
    expect(projected.weight[2]).toBeGreaterThan(1);
  });
});

describe('render', () => {
  it('draws the moving object where it is at the in-between time', () => {
    const a = scene(0);
    const b = scene(12);
    const mid = render(a, b, blockMotion(12, 0.5), 0.5);
    const fade = a.data.map((v, i) => (v + b.data[i]) / 2);
    expect(meanAbsError(mid, scene(6).data)).toBeLessThan(meanAbsError(fade, scene(6).data) * 0.35);
  });

  it('keeps transparency for cut-outs', () => {
    const mid = render(scene(0, true), scene(12, true), blockMotion(12, 0.5), 0.5);
    expect(mid[(5 * W + 5) * 4 + 3]).toBe(0);
    expect(mid[(45 * W + 56) * 4 + 3]).toBe(255);
  });

  it('gives the same result from photos premultiplied once per pair', () => {
    const a = scene(0, true);
    const b = scene(12, true);
    const motion = blockMotion(12, 0.25);
    expect(render(premultiplyImage(a), premultiplyImage(b), motion, 0.25)).toEqual(render(a, b, motion, 0.25));
  });
});
