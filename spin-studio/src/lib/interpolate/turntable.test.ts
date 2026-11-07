import { describe, expect, it } from 'vitest';
import { premultiplyImage, render, toGray, type RGBAImage } from './flow';
import { AXIS_X, renderBox, SCENE, trueMotion } from './testScene';
import { estimateDepth, estimateGeometry, rigidSurfaces, turnDisplacement, turnFlow } from './turntable';

const STEP = Math.PI / 6; // 30° between photos: 12 photos for a full turn
const START = 0.35;

function pairAt(transparent = false) {
  const a = renderBox(START, transparent);
  const b = renderBox(START + STEP, transparent);
  return { a, b, ga: toGray(a), gb: toGray(b) };
}

function turnOf(ga: ReturnType<typeof toGray>, gb: ReturnType<typeof toGray>) {
  const geometry = estimateGeometry(ga, gb, STEP);
  return {
    geometry,
    fromA: rigidSurfaces(estimateDepth(ga, gb, STEP, geometry)),
    fromB: rigidSurfaces(estimateDepth(gb, ga, -STEP, geometry)),
  };
}

/** Mean colour difference, over pixels where either image shows the box. */
function error(image: Uint8ClampedArray, truth: RGBAImage) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < truth.data.length; i += 4) {
    if (truth.data[i] === 235 && image[i] === 235) continue;
    for (let c = 0; c < 3; c++) sum += Math.abs(image[i + c] - truth.data[i + c]);
    n += 3;
  }
  return sum / n;
}

/** Leftmost and rightmost box pixel in the middle row. */
function extent(image: Uint8ClampedArray) {
  const y = Math.round(SCENE.height * 0.6);
  let left = -1;
  let right = -1;
  for (let x = 0; x < SCENE.width; x++) {
    const o = (y * SCENE.width + x) * 4;
    if (Math.abs(image[o] - 235) + Math.abs(image[o + 2] - 235) > 30) {
      if (left < 0) left = x;
      right = x;
    }
  }
  return { left, right, width: right - left };
}

describe('estimateGeometry', () => {
  it('finds the turning axis and the camera tilt', () => {
    const { ga, gb } = pairAt();
    const { axis, tilt } = estimateGeometry(ga, gb, STEP);
    expect(Math.abs(axis - AXIS_X)).toBeLessThan(SCENE.width * 0.03);
    // The sign of the tilt also encodes the turning direction.
    expect(Math.abs(Math.abs(tilt) - Math.sin(SCENE.tilt))).toBeLessThan(0.1);
  });
});

describe('estimateDepth + rigidSurfaces', () => {
  it('recovers how the box moves', () => {
    const { ga, gb } = pairAt();
    const { fromA } = turnOf(ga, gb);
    const estimated = turnFlow(fromA);
    const truth = trueMotion(START, START + STEP);
    let err = 0;
    let motion = 0;
    let n = 0;
    for (let i = 0; i < truth.u.length; i++) {
      if (!truth.onBox[i]) continue;
      err += Math.hypot(estimated.u[i] - truth.u[i], estimated.v[i] - truth.v[i]);
      motion += Math.hypot(truth.u[i], truth.v[i]);
      n++;
    }
    // Most of the motion is found (not merely "no motion").
    expect(err / n).toBeLessThan((motion / n) * 0.35);
  });
});

describe('in-between frames', () => {
  it('are much closer to the true view than a cross-fade, without shrinking the object', () => {
    const { a, b, ga, gb } = pairAt();
    const { fromA, fromB } = turnOf(ga, gb);
    const truth = renderBox(START + STEP / 2);
    const mid = render(a, b, turnDisplacement(fromA, fromB, 0.5), 0.5);
    const fade = new Uint8ClampedArray(a.data.length);
    for (let i = 0; i < fade.length; i++) fade[i] = (a.data[i] + b.data[i]) / 2;
    expect(error(mid, truth)).toBeLessThan(error(fade, truth) * 0.75);
    // Straight-line motion would make the box narrower between photos.
    const made = extent(mid);
    const real = extent(truth.data);
    expect(Math.abs(made.width - real.width)).toBeLessThan(real.width * 0.06);
    expect(Math.abs(made.left - real.left)).toBeLessThan(SCENE.width * 0.03);
  });

  it('keep transparency for cut-outs', () => {
    const { a, b, ga, gb } = pairAt(true);
    const { fromA, fromB } = turnOf(ga, gb);
    const mid = render(premultiplyImage(a), premultiplyImage(b), turnDisplacement(fromA, fromB, 0.5), 0.5);
    expect(mid[(5 * SCENE.width + 5) * 4 + 3]).toBe(0);
    const centre = (Math.round(SCENE.height * 0.55) * SCENE.width + SCENE.width / 2) * 4;
    expect(mid[centre + 3]).toBe(255);
  });
});
