/*
 * Building blocks for in-between frames, in plain TypeScript so they run in a
 * worker and can be unit tested: grey images, census matching costs and their
 * semi-global aggregation (used by turntable.ts to find the motion), and
 * rendering — both photos pushed forward to the in-between time and combined.
 *
 * Rendering: every pixel of each photo is pushed to where it sits at the
 * in-between time; where few pixels of a photo land, that part of the object
 * is hidden in it, so the other photo is used there. Where the two warped
 * photos agree they are blended; where they disagree the photo nearer in time
 * wins, region by region — blending disagreeing pixels would show both
 * versions at once, a double exposure.
 */

export interface Gray {
  width: number;
  height: number;
  data: Float32Array;
}

export interface Flow {
  width: number;
  height: number;
  /** Displacement in pixels of this flow field's own grid. */
  u: Float32Array;
  v: Float32Array;
}

export interface RGBAImage {
  width: number;
  height: number;
  /** Straight (non-premultiplied) RGBA, as canvas ImageData provides. */
  data: Uint8ClampedArray;
}

/** Longer side of the grid on which motion is estimated. */
export const FLOW_SIZE = 320;

/** Premultiplied luminance, box-downscaled so the longer side is at most `maxSize`. */
export function toGray(image: RGBAImage, maxSize = FLOW_SIZE): Gray {
  const { width, height, data } = image;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const sum = new Float32Array(w * h);
  const count = new Float32Array(w * h);
  for (let y = 0; y < height; y++) {
    const row = Math.min(h - 1, Math.floor((y * h) / height)) * w;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * (data[i + 3] / 255);
      const t = row + Math.min(w - 1, Math.floor((x * w) / width));
      sum[t] += luma;
      count[t]++;
    }
  }
  for (let i = 0; i < sum.length; i++) sum[i] /= count[i] || 1;
  return { width: w, height: h, data: sum };
}

export function downsample(g: Gray): Gray {
  const w = Math.max(1, g.width >> 1);
  const h = Math.max(1, g.height >> 1);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.min(g.width - 1, 2 * x);
      const y0 = Math.min(g.height - 1, 2 * y);
      const x1 = Math.min(g.width - 1, x0 + 1);
      const y1 = Math.min(g.height - 1, y0 + 1);
      data[y * w + x] =
        (g.data[y0 * g.width + x0] + g.data[y0 * g.width + x1] + g.data[y1 * g.width + x0] + g.data[y1 * g.width + x1]) /
        4;
    }
  }
  return { width: w, height: h, data };
}

/** 5×5 census transform: one bit per neighbour, set when it is darker than the centre. */
export function census(g: Gray): Uint32Array {
  const { width: w, height: h, data } = g;
  const out = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      let bits = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy)) * w;
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          // A small tolerance keeps flat and transparent areas from producing noise bits.
          bits = (bits << 1) | (data[yy + xx] < c - 2 ? 1 : 0);
        }
      }
      out[y * w + x] = bits >>> 0;
    }
  }
  return out;
}

export function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff;
}

/** In-place separable box sum with radius r (edges clamped). */
function boxSum(src: Float32Array, w: number, h: number, r: number, tmp: Float32Array, out: Float32Array) {
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

export function median3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  const win = new Float32Array(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy)) * w;
        for (let dx = -1; dx <= 1; dx++) win[n++] = src[yy + Math.min(w - 1, Math.max(0, x + dx))];
      }
      out[y * w + x] = median9(win);
    }
  }
  return out;
}

// Compare-and-swap pairs of a sorting network that leaves the median of 9 at index 4.
const MEDIAN9 = [1, 2, 4, 5, 7, 8, 0, 1, 3, 4, 6, 7, 1, 2, 4, 5, 7, 8, 0, 3, 5, 8, 4, 7, 3, 6, 1, 4, 2, 5, 4, 7, 4, 2, 6, 4, 4, 2];

/** Median of 9 values (reorders `p`); far faster than sorting them. */
function median9(p: Float32Array): number {
  for (let k = 0; k < MEDIAN9.length; k += 2) {
    const i = MEDIAN9[k];
    const j = MEDIAN9[k + 1];
    if (p[i] > p[j]) {
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
  }
  return p[4];
}

export function parabola(a: number | undefined, b: number, c: number | undefined): number {
  if (a === undefined || c === undefined) return 0;
  const denom = a - 2 * b + c;
  if (denom <= 1e-6) return 0;
  return Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denom)));
}

export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  boxSum(src, w, h, r, tmp, out);
  const area = (2 * r + 1) * (2 * r + 1);
  for (let i = 0; i < out.length; i++) out[i] /= area;
  return out;
}

/** Removes slow brightness changes (shading as faces turn) and keeps structure. */
export function highPass(g: Gray): Float32Array {
  const blurred = boxBlur(boxBlur(g.data, g.width, g.height, 3), g.width, g.height, 3);
  const out = new Float32Array(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = g.data[i] - blurred[i];
  return out;
}

/**
 * Semi-global aggregation of a cost volume (D candidates per pixel) along four
 * directions: a small penalty for changing by one candidate between
 * neighbours, a larger one for jumps — smaller across edges of `guide`, where
 * object outlines are likely.
 */
export function aggregate(cost: Uint8Array, w: number, h: number, D: number, guide: Float32Array): Uint16Array {
  const P1 = 8;
  const P2 = 64;
  const total = new Uint16Array(w * h * D);
  const prev = new Float32Array(D);
  const curr = new Float32Array(D);
  const paths: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of paths) {
    const lines = dx !== 0 ? h : w;
    const length = dx !== 0 ? w : h;
    for (let line = 0; line < lines; line++) {
      let prevMin = 0;
      let prevIndex = -1;
      for (let step = 0; step < length; step++) {
        const pos = dx > 0 || dy > 0 ? step : length - 1 - step;
        const x = dx !== 0 ? pos : line;
        const y = dx !== 0 ? line : pos;
        const i = y * w + x;
        let currMin = Infinity;
        if (prevIndex < 0) {
          for (let k = 0; k < D; k++) curr[k] = cost[i * D + k];
        } else {
          const edge = Math.abs(guide[i] - guide[prevIndex]);
          const p2 = Math.max(P1 + 1, P2 / (1 + edge / 8));
          for (let k = 0; k < D; k++) {
            let best = prev[k];
            if (k > 0 && prev[k - 1] + P1 < best) best = prev[k - 1] + P1;
            if (k < D - 1 && prev[k + 1] + P1 < best) best = prev[k + 1] + P1;
            if (prevMin + p2 < best) best = prevMin + p2;
            curr[k] = cost[i * D + k] + best - prevMin;
          }
        }
        for (let k = 0; k < D; k++) {
          total[i * D + k] += curr[k];
          if (curr[k] < currMin) currMin = curr[k];
        }
        prev.set(curr);
        prevMin = currMin;
        prevIndex = i;
      }
    }
  }
  return total;
}

/** The cheapest candidate per pixel, with sub-candidate precision. */
export function winners(total: Uint16Array, n: number, D: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let bestK = 0;
    let best = Infinity;
    for (let k = 0; k < D; k++) {
      if (total[i * D + k] < best) {
        best = total[i * D + k];
        bestK = k;
      }
    }
    const sub =
      bestK > 0 && bestK < D - 1 ? parabola(total[i * D + bestK - 1], best, total[i * D + bestK + 1]) : 0;
    out[i] = bestK + sub;
  }
  return out;
}

export interface ProjectedFlow extends Flow {
  /** How many source pixels landed here; near 0 means hidden in the source photo. */
  weight: Float32Array;
  /** Nearness of what landed here, when the sources' nearness was given. */
  near?: Float32Array;
}

/**
 * Pushes every grid point forward by its displacement (du, dv) and records, at
 * its new position, the vector pointing back to where it came from.
 */
export function project(
  du: Float32Array,
  dv: Float32Array,
  w: number,
  h: number,
  near?: Float32Array,
): ProjectedFlow {
  const n = w * h;
  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const weight = new Float32Array(n);
  const landedNear = near ? new Float32Array(n) : undefined;
  // Visits the four grid points each source point lands between, with weights.
  const each = (visit: (i: number, j: number, wt: number) => void) => {
    const tap = (i: number, xx: number, yy: number, wt: number) => {
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && wt > 0) visit(i, yy * w + xx, wt);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const tx = x + du[i];
        const ty = y + dv[i];
        const x0 = Math.floor(tx);
        const y0 = Math.floor(ty);
        const ax = tx - x0;
        const ay = ty - y0;
        tap(i, x0, y0, (1 - ax) * (1 - ay));
        tap(i, x0 + 1, y0, ax * (1 - ay));
        tap(i, x0, y0 + 1, (1 - ax) * ay);
        tap(i, x0 + 1, y0 + 1, ax * ay);
      }
    }
  };
  each((i, j, wt) => {
    u[j] -= wt * du[i];
    v[j] -= wt * dv[i];
    weight[j] += wt;
    if (near && landedNear) landedNear[j] += wt * near[i];
  });
  // Where a surface stretches, pushed pixels land unevenly (alternate columns
  // get more or fewer); smoothing the sums before normalising removes that
  // aliasing, which would otherwise show up as stripes.
  const su = boxBlur(boxBlur(u, w, h, 1), w, h, 1);
  const sv = boxBlur(boxBlur(v, w, h, 1), w, h, 1);
  const sw = boxBlur(boxBlur(weight, w, h, 1), w, h, 1);
  const sn = landedNear ? boxBlur(boxBlur(landedNear, w, h, 1), w, h, 1) : undefined;
  for (let j = 0; j < n; j++) {
    if (sw[j] > 1e-3) {
      su[j] /= sw[j];
      sv[j] /= sw[j];
      if (sn) sn[j] /= sw[j];
    } else {
      // Nothing landed here: fall back to the displacement of this grid point.
      su[j] = -du[j];
      sv[j] = -dv[j];
      if (sn && near) sn[j] = near[j];
    }
  }
  return { width: w, height: h, u: su, v: sv, weight: sw, near: sn };
}

/**
 * 1 where the object is (anything that differs between the photos, filled in
 * across each row so plain areas of the object count too), 0 on a background
 * that stays put, softened so the two blend without a seam.
 */
export function movingMask(ga: Gray, gb: Gray): Float32Array {
  const { width: w, height: h } = ga;
  const diff = new Float32Array(w * h);
  for (let i = 0; i < diff.length; i++) diff[i] = Math.abs(ga.data[i] - gb.data[i]);
  const blurred = boxBlur(diff, w, h, 1);
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (blurred[y * w + x] > 4) {
        if (first < 0) first = x;
        last = x;
      }
    }
    for (let x = Math.max(0, first); x <= last; x++) mask[y * w + x] = 1;
  }
  const r = Math.max(1, Math.round(Math.max(w, h) / 80));
  return boxBlur(boxBlur(mask, w, h, r), w, h, r);
}

/** The turning axis: the middle of the moving region's horizontal extent. */
export function estimateAxis(mask: Float32Array, w: number, h: number): number {
  const columns = new Float32Array(w);
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      columns[x] += mask[y * w + x];
      total += mask[y * w + x];
    }
  }
  if (total < 1) return (w - 1) / 2;
  let sum = 0;
  let left = 0;
  let right = w - 1;
  for (let x = 0; x < w; x++) {
    const before = sum;
    sum += columns[x];
    if (before < total * 0.02 && sum >= total * 0.02) left = x;
    if (before < total * 0.98 && sum >= total * 0.98) right = x;
  }
  return (left + right) / 2;
}

/** An image whose colour channels are already multiplied by alpha. */
export interface PremultipliedImage extends RGBAImage {
  premultiplied: true;
}

/**
 * Premultiplies once, so a pair of photos can be reused for every in-between
 * frame. Blending premultiplied colour keeps cut-out edges free of dark fringes.
 */
export function premultiplyImage(image: RGBAImage): PremultipliedImage {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    out[i] = data[i] * a;
    out[i + 1] = data[i + 1] * a;
    out[i + 2] = data[i + 2] * a;
    out[i + 3] = data[i + 3];
  }
  return { width, height, data: out, premultiplied: true };
}

function premultiplied(image: RGBAImage | PremultipliedImage): Uint8ClampedArray {
  return 'premultiplied' in image ? image.data : premultiplyImage(image).data;
}

/** Where each grid point of the two photos moves by the in-between time. */
export interface Displacement {
  width: number;
  height: number;
  duA: Float32Array;
  dvA: Float32Array;
  duB: Float32Array;
  dvB: Float32Array;
  /**
   * How near each grid point is to the camera at the in-between time (larger
   * is nearer, in grid pixels), when known: hidden surfaces are then dropped
   * where several land on the same spot, and where the two photos disagree the
   * nearer surface wins — as in reality.
   */
  nearA?: Float32Array;
  nearB?: Float32Array;
}

/**
 * Warps both photos to the in-between time `t` and combines them: blended
 * where they agree; where they disagree, the photo nearer in time wins.
 */
export function render(
  a: RGBAImage | PremultipliedImage,
  b: RGBAImage | PremultipliedImage,
  motion: Displacement,
  t: number,
): Uint8ClampedArray {
  const { width, height } = a;
  const { width: fw, height: fh } = motion;
  const sx = fw / width;
  const sy = fh / height;
  const toA = project(motion.duA, motion.dvA, fw, fh, motion.nearA);
  const toB = project(motion.duB, motion.dvB, fw, fh, motion.nearB);
  const nearA = toA.near;
  const nearB = toB.near;
  const nearMargin = Math.max(2, fw * 0.03);
  const pa = premultiplied(a);
  const pb = premultiplied(b);
  const out = new Uint8ClampedArray(width * height * 4);
  const sampleA = new Float32Array(4);
  const sampleB = new Float32Array(4);

  // Where do the two warped photos disagree? Measured on the coarse grid and
  // blurred, so the choice between them is made per region, not per pixel
  // (per-pixel choices flicker into stripes).
  let disagree: Float32Array = new Float32Array(fw * fh);
  for (let gy = 0; gy < fh; gy++) {
    for (let gx = 0; gx < fw; gx++) {
      const i = gy * fw + gx;
      const x = (gx + 0.5) / sx - 0.5;
      const y = (gy + 0.5) / sy - 0.5;
      bilinear(pa, width, height, x + toA.u[i] / sx, y + toA.v[i] / sy, sampleA);
      bilinear(pb, width, height, x + toB.u[i] / sx, y + toB.v[i] / sy, sampleB);
      disagree[i] =
        (Math.abs(sampleA[0] - sampleB[0]) +
          Math.abs(sampleA[1] - sampleB[1]) +
          Math.abs(sampleA[2] - sampleB[2]) +
          Math.abs(sampleA[3] - sampleB[3])) /
        4;
    }
  }
  disagree = boxBlur(boxBlur(disagree, fw, fh, 2), fw, fh, 2);

  // Which photo to trust where they disagree, decided per region too: the
  // surface nearer the camera when both photos see something there and their
  // depths clearly differ, otherwise the photo nearer in time (1 = a, 0 = b).
  let preferA: Float32Array = new Float32Array(fw * fh);
  for (let i = 0; i < preferA.length; i++) {
    const visA = Math.min(1, toA.weight[i]);
    const visB = Math.min(1, toB.weight[i]);
    const gap = nearA && nearB ? nearA[i] - nearB[i] : 0;
    preferA[i] =
      visA > 0.3 && visB > 0.3 && Math.abs(gap) > nearMargin
        ? gap > 0
          ? 1
          : 0
        : (1 - t) * (visA > 0.3 ? 1 : visA) >= t * (visB > 0.3 ? 1 : visB)
          ? 1
          : 0;
  }
  preferA = boxBlur(boxBlur(preferA, fw, fh, 2), fw, fh, 2);

  // Every output pixel samples the coarse grids at the same column positions,
  // so the bilinear taps are computed once per column and once per row.
  const col0 = new Int32Array(width);
  const col1 = new Int32Array(width);
  const colA = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const fx = Math.min(fw - 1, Math.max(0, (x + 0.5) * sx - 0.5));
    col0[x] = Math.floor(fx);
    col1[x] = Math.min(fw - 1, col0[x] + 1);
    colA[x] = fx - col0[x];
  }

  for (let y = 0; y < height; y++) {
    const fy = Math.min(fh - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const row0 = y0 * fw;
    const row1 = Math.min(fh - 1, y0 + 1) * fw;
    const ay = fy - y0;
    for (let x = 0; x < width; x++) {
      const ax = colA[x];
      const i00 = row0 + col0[x];
      const i10 = row0 + col1[x];
      const i01 = row1 + col0[x];
      const i11 = row1 + col1[x];
      const w00 = (1 - ax) * (1 - ay);
      const w10 = ax * (1 - ay);
      const w01 = (1 - ax) * ay;
      const w11 = ax * ay;
      const ua = toA.u[i00] * w00 + toA.u[i10] * w10 + toA.u[i01] * w01 + toA.u[i11] * w11;
      const va = toA.v[i00] * w00 + toA.v[i10] * w10 + toA.v[i01] * w01 + toA.v[i11] * w11;
      const wa = toA.weight[i00] * w00 + toA.weight[i10] * w10 + toA.weight[i01] * w01 + toA.weight[i11] * w11;
      const ub = toB.u[i00] * w00 + toB.u[i10] * w10 + toB.u[i01] * w01 + toB.u[i11] * w11;
      const vb = toB.v[i00] * w00 + toB.v[i10] * w10 + toB.v[i01] * w01 + toB.v[i11] * w11;
      const wb = toB.weight[i00] * w00 + toB.weight[i10] * w10 + toB.weight[i01] * w01 + toB.weight[i11] * w11;
      const dis = disagree[i00] * w00 + disagree[i10] * w10 + disagree[i01] * w01 + disagree[i11] * w11;
      const pickA = preferA[i00] * w00 + preferA[i10] * w10 + preferA[i01] * w01 + preferA[i11] * w11;
      bilinear(pa, width, height, x + ua / sx, y + va / sy, sampleA);
      bilinear(pb, width, height, x + ub / sx, y + vb / sy, sampleB);
      // Each photo counts more the closer we are to it in time, and only where
      // the moving object is actually visible in it.
      const visA = Math.min(1, wa);
      const visB = Math.min(1, wb);
      let w0 = (1 - t) * visA;
      let w1 = t * visB;
      if (w0 + w1 < 1e-3) {
        w0 = 1 - t;
        w1 = t;
      }
      // Where the two warped photos disagree, hand the region to one of them.
      const select = smoothstep(8, 24, dis);
      if (select > 0) {
        const sum = w0 + w1;
        w0 = w0 * (1 - select) + sum * pickA * select;
        w1 = w1 * (1 - select) + sum * (1 - pickA) * select;
      }
      const norm = 1 / (w0 + w1);
      const o = (y * width + x) * 4;
      const alpha = (sampleA[3] * w0 + sampleB[3] * w1) * norm;
      out[o + 3] = alpha;
      const un = alpha > 0 ? 255 / alpha : 0;
      out[o] = (sampleA[0] * w0 + sampleB[0] * w1) * norm * un;
      out[o + 1] = (sampleA[1] * w0 + sampleB[1] * w1) * norm * un;
      out[o + 2] = (sampleA[2] * w0 + sampleB[2] * w1) * norm * un;
    }
  }
  return out;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function bilinear(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Float32Array) {
  const cx = Math.min(w - 1, Math.max(0, x));
  const cy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const ax = cx - x0;
  const ay = cy - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    out[c] =
      (data[i00 + c] * (1 - ax) + data[i10 + c] * ax) * (1 - ay) + (data[i01 + c] * (1 - ax) + data[i11 + c] * ax) * ay;
  }
}
