import {
  aggregate,
  boxBlur,
  census,
  downsample,
  estimateAxis,
  highPass,
  median3,
  movingMask,
  parabola,
  popcount,
  winners,
  type Displacement,
  type Flow,
  type Gray,
} from './flow';

/*
 * Motion of an object turning about a vertical axis — how 360° photos are
 * taken, on a turntable or walking around the object.
 *
 * Seen from a camera that looks slightly down, every point of the object
 * travels along an ellipse. With the angle between two photos known (a full
 * turn divided by the number of photos), a point's whole path follows from
 * where it is in the picture, its depth (how far in front of or behind the
 * axis it is — the one unknown per pixel), and two numbers shared by the whole
 * picture: where the axis is and how much the camera tilts.
 *
 * 1. Geometry: the axis and tilt under which the object's columns, compared by
 *    their top-to-bottom pattern of edges, find the best partners. (That
 *    pattern looks the same when a surface turns away and gets squeezed
 *    sideways; small patches don't.)
 * 2. Depth, coarse to fine, searching only along each pixel's possible path:
 *    on a small copy of the photos a big turn is just a few pixels; each finer
 *    level first warps the other photo by the depth found so far, which undoes
 *    most of the squeeze, then corrects it by a few pixels.
 * 3. Rigidity: each column of the object moves as one (with lids and tops
 *    handled as level surfaces), so matching noise can't bend edges and
 *    outlines into curves — the "jelly" look of plain optical flow.
 * 4. In-between frames turn every point by part of the angle, along its arc.
 *    Straight-line motion would cut the corner, so the object would shrink
 *    between photos and spring back at each one.
 */

export interface Turn {
  /** Size of the grid the motion is described on. */
  width: number;
  height: number;
  /** Turn from this photo to the other one, in radians. */
  angle: number;
  /** x of the turning axis on the grid. */
  axis: number;
  /** Sine of the camera's tilt; its sign also absorbs the direction of the turn. */
  tilt: number;
  /** Each grid point's depth in front of (or behind) the axis, in grid pixels. */
  depth: Float32Array;
  /** 1 on the object, 0 on a background that stays still. */
  mask: Float32Array;
}

/** Matching runs on the finest pyramid level whose shorter side is below this. */
const MATCH_MAX_SIDE = 192;

export interface Geometry {
  /** x of the turning axis on the grid. */
  axis: number;
  /** Sine of the camera's tilt (sign also encodes the turning direction). */
  tilt: number;
}

/** Camera tilts tried, in degrees; the sign also encodes the turning direction. */
export const TILTS: readonly number[] = Array.from({ length: 41 }, (_, i) => i * 2 - 40);

export interface PairMeasurement extends Geometry {
  /** How badly each of TILTS explains this pair (lower is better). */
  scores: number[];
}

/**
 * Axis and tilt for a pair: the combination under which the object's columns,
 * compared by their top-to-bottom pattern of edges, find the best partners.
 * Returns the score of every tilt too, so a whole sequence can be judged
 * together (see combineGeometry): with symmetric objects, single pairs can be
 * fooled.
 */
export function estimateGeometry(a: Gray, b: Gray, angle: number, mask = movingMask(a, b)): PairMeasurement {
  const { width: w, height: h } = a;
  const guess = estimateAxis(mask, w, h);
  const extent = maskExtent(mask, w, h);
  const zmax = Math.max(8, Math.ceil(Math.max(guess - extent.left, extent.right - guess) * 1.15));
  const pa = verticalProfiles(a);
  const pb = verticalProfiles(b);
  const deg = Math.PI / 180;
  const score = (axis: number, tilt: number) => columnScore(pa, pb, mask, w, h, angle, axis, Math.sin(tilt * deg), zmax, 2);
  const scores = TILTS.map((tilt) => score(guess, tilt));
  const best = bestTilt(scores);
  let axis = guess;
  let lowest = Math.min(...scores);
  for (const offset of [-0.04, -0.02, 0.02, 0.04]) {
    const value = score(guess + offset * w, best);
    if (value < lowest) {
      lowest = value;
      axis = guess + offset * w;
    }
  }
  return { axis, tilt: Math.sin(best * deg), scores };
}

/** The tilt (degrees) with the lowest score, refined between candidates by a parabola. */
function bestTilt(scores: number[]): number {
  const k = scores.indexOf(Math.min(...scores));
  const offset = k > 0 && k < scores.length - 1 ? parabola(scores[k - 1], scores[k], scores[k + 1]) : 0;
  return TILTS[k] + offset * (TILTS[1] - TILTS[0]);
}

/**
 * One axis and tilt for a whole turn — the camera doesn't move between
 * photos. The tilt with the lowest total score over all pairs wins, so pairs
 * with a clear answer outweigh those a symmetric object misled; the axis is
 * the median (in whatever unit the pairs use).
 */
export function combineGeometry(pairs: PairMeasurement[]): Geometry {
  const total = TILTS.map((_, k) => pairs.reduce((sum, p) => sum + (Number.isFinite(p.scores[k]) ? p.scores[k] : 1), 0));
  const best = bestTilt(total);
  const axes = pairs.map((p) => p.axis).sort((x, y) => x - y);
  return { axis: axes[axes.length >> 1], tilt: Math.sin((best * Math.PI) / 180) };
}

/**
 * Depth by coarse-to-fine matching along each pixel's path. On a small copy
 * of the photos a big turn is only a few pixels, so a full search is cheap and
 * reliable. Each finer level first warps `b` by the depth found so far — which
 * undoes most of the sideways squeeze of turning surfaces — and then only
 * corrects it by a few pixels, so matches never have to bridge very different
 * looking views.
 */
export function estimateDepth(a: Gray, b: Gray, angle: number, known?: Geometry): Turn {
  const { width: w, height: h } = a;
  const mask = movingMask(a, b);
  const { axis, tilt } = known ?? estimateGeometry(a, b, angle, mask);
  const extent = maskExtent(mask, w, h);
  const reach = Math.max(8, Math.max(axis - extent.left, extent.right - axis) * 1.15);
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // Pyramid from the matching level (shorter side below MATCH_MAX_SIDE) down to ~30 px.
  const levelsA: Gray[] = [a];
  const levelsB: Gray[] = [b];
  while (Math.min(levelsA[0].width, levelsA[0].height) >= 48) {
    levelsA.unshift(downsample(levelsA[0]));
    levelsB.unshift(downsample(levelsB[0]));
  }
  // The finest level whose shorter side is below MATCH_MAX_SIDE.
  let last = 0;
  while (last + 1 < levelsA.length && Math.min(levelsA[last + 1].width, levelsA[last + 1].height) < MATCH_MAX_SIDE) last++;

  let depth: Float32Array | null = null;
  let dw = 0;
  let dh = 0;
  for (let level = 0; level <= last; level++) {
    const la = levelsA[level];
    const lb = levelsB[level];
    const lw = la.width;
    const lh = la.height;
    const scale = w / lw;
    const ax = (axis + 0.5) / scale - 0.5;
    const cA = census(la);
    let z: Float32Array;
    if (!depth) {
      // Full search on the smallest level.
      const zmax = Math.ceil(reach / scale) + 2;
      const D = 2 * zmax + 1;
      const cB = census(lb);
      const cost = new Uint8Array(lw * lh * D);
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const i = y * lw + x;
          const X = x - ax;
          for (let k = 0; k < D; k++) {
            const zk = k - zmax;
            const bx = Math.round(x + X * (c - 1) + zk * s);
            const by = Math.round(y - tilt * (X * s + zk * (1 - c)));
            cost[i * D + k] = bx < 0 || by < 0 || bx >= lw || by >= lh ? 96 : popcount(cA[i] ^ cB[by * lw + bx]) * 4;
          }
        }
      }
      z = winners(aggregate(cost, lw, lh, D, la.data), lw * lh, D);
      for (let i = 0; i < z.length; i++) z[i] -= zmax;
    } else {
      // Previous depth, doubled for the finer grid; warp b by it, then correct.
      z = new Float32Array(lw * lh);
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          z[y * lw + x] = sample(depth, dw, dh, (x + 0.5) / 2 - 0.5, (y + 0.5) / 2 - 0.5) * 2;
        }
      }
      const warped = new Float32Array(lw * lh);
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const i = y * lw + x;
          const X = x - ax;
          warped[i] = sample(lb.data, lw, lh, x + X * (c - 1) + z[i] * s, y - tilt * (X * s + z[i] * (1 - c)));
        }
      }
      const cW = census({ width: lw, height: lh, data: warped });
      const R = 4;
      const D = 2 * R + 1;
      // One candidate step moves the match one pixel sideways along its path.
      const dzStep = 1 / Math.max(0.2, Math.abs(s));
      const dyStep = -tilt * dzStep * (1 - c);
      const cost = new Uint8Array(lw * lh * D);
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const i = y * lw + x;
          for (let k = 0; k < D; k++) {
            const r = k - R;
            const bx = x + Math.sign(s) * r;
            const by = Math.round(y + r * dyStep);
            cost[i * D + k] = bx < 0 || by < 0 || bx >= lw || by >= lh ? 96 : popcount(cA[i] ^ cW[by * lw + bx]) * 4;
          }
        }
      }
      const correction = winners(aggregate(cost, lw, lh, D, la.data), lw * lh, D);
      for (let i = 0; i < z.length; i++) z[i] += (correction[i] - R) * dzStep;
    }
    depth = median3(z, lw, lh);
    dw = lw;
    dh = lh;
  }

  // Up to the full grid, then smoothed where there is no texture to go by.
  const full = new Float32Array(w * h);
  const scale = w / dw;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      full[y * w + x] = sample(depth!, dw, dh, (x + 0.5) / scale - 0.5, (y + 0.5) / scale - 0.5) * scale;
    }
  }
  const radius = Math.max(2, Math.round(Math.max(w, h) / 64));
  return { width: w, height: h, angle, axis, tilt, depth: smoothDepth(full, highPass(a), w, h, radius), mask };
}

/**
 * Smooths depth with a wide box filter (three passes ≈ Gaussian), weighted by
 * texture so measurements on detail outweigh guesses in plain areas. A box
 * filter leaves linear depth — any flat surface, upright or seen from above —
 * unchanged, so it removes noise (which bends edges when warping) without
 * rounding the object's faces.
 */
function smoothDepth(depth: Float32Array, detail: Float32Array, w: number, h: number, r: number): Float32Array {
  let weight: Float32Array = new Float32Array(w * h);
  let weighted: Float32Array = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = detail[y * w + Math.min(w - 1, x + 1)] - detail[y * w + Math.max(0, x - 1)];
      const gy = detail[Math.min(h - 1, y + 1) * w + x] - detail[Math.max(0, y - 1) * w + x];
      weight[i] = 0.05 + Math.min(1, Math.hypot(gx, gy) / 24);
      weighted[i] = depth[i] * weight[i];
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    weighted = boxBlur(weighted, w, h, r);
    weight = boxBlur(weight, w, h, r);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = weighted[i] / weight[i];
  return out;
}

/**
 * Makes the object move rigidly. Within one column of the picture the object
 * is an upright surface (a box's side, a bottle, a car's flank), whose depth
 * is the same all the way down, often topped by a level one (a lid, a roof),
 * whose depth grows down the picture at a rate fixed by the camera's tilt.
 * Each column fits a line of each kind to the measured depths (robustly, by
 * medians): upright from its lower part, level from its upper part. Pixels
 * above the point where the two lines meet — the crease, like a lid's front
 * edge — follow the level line, the rest the upright one, so the two join
 * without a gap. Matching noise then can't bend edges and outlines into
 * curves (the "jelly" look), while lids and tops still turn the way they
 * should. Objects lying flat (a watch) come out as all level.
 */
export function rigidSurfaces(turn: Turn): Turn {
  const { width: w, height: h, depth, mask, tilt } = turn;
  // Level surfaces are only visible from a camera that looks down a little.
  const slope = Math.abs(tilt) > 0.07 ? 1 / tilt : 0;
  const upright = new Float32Array(w);
  const level = new Float32Array(w);
  const has = new Uint8Array(w);
  const rows: number[] = [];
  const values: number[] = [];
  for (let x = 0; x < w; x++) {
    rows.length = 0;
    for (let y = 0; y < h; y++) if (mask[y * w + x] > 0.5) rows.push(y);
    if (rows.length < 6) continue;
    has[x] = 1;
    values.length = 0;
    for (const y of rows.slice(rows.length >> 1)) values.push(depth[y * w + x]);
    upright[x] = median(values);
    if (slope) {
      values.length = 0;
      for (const y of rows.slice(0, Math.max(3, Math.round(rows.length * 0.4)))) values.push(depth[y * w + x] - y * slope);
      level[x] = median(values);
    }
  }
  const r = Math.max(2, Math.round(w / 80));
  const fill = (line: Float32Array) => blur1d(blur1d(median5(fillGaps(line, has)), r), r);
  const up = fill(upright);
  const lv = slope ? fill(level) : level;

  // Per column, the row of the crease: level above it, upright below.
  const crease = new Float32Array(w).fill(-1);
  if (slope) {
    for (let x = 0; x < w; x++) {
      if (!has[x]) continue;
      const meet = (up[x] - lv[x]) / slope;
      const fit = (from: number, to: number) => {
        let errUp = 0;
        let errLevel = 0;
        let n = 0;
        for (let y = Math.max(0, Math.ceil(from)); y < Math.min(h, to); y++) {
          if (mask[y * w + x] < 0.5) continue;
          const z = depth[y * w + x];
          errUp += Math.abs(z - up[x]);
          errLevel += Math.abs(z - (lv[x] + y * slope));
          n++;
        }
        return { errUp, errLevel, n };
      };
      const above = fit(0, meet);
      const below = fit(meet, h);
      if (below.n >= 6 && below.errLevel < 0.7 * below.errUp) crease[x] = h; // all level
      else if (above.n >= 3 && above.errLevel < 0.7 * above.errUp) crease[x] = meet;
    }
  }
  // Level parts must be a clear feature of the object, not scattered guesses
  // (those tear the picture where neighbouring columns disagree): used only
  // when many columns show one, along a crease smoothed across columns.
  let columns = 0;
  let withLevel = 0;
  for (let x = 0; x < w; x++) {
    if (!has[x]) continue;
    columns++;
    if (crease[x] >= 0) withLevel++;
  }
  const out = new Float32Array(w * h);
  if (withLevel < columns * 0.35) {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) out[y * w + x] = up[x];
    return { ...turn, depth: out };
  }
  const known = new Uint8Array(w);
  for (let x = 0; x < w; x++) known[x] = has[x] && crease[x] >= 0 ? 1 : 0;
  const line = blur1d(median5(fillGaps(crease, known)), r);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) out[y * w + x] = y < line[x] ? lv[x] + y * slope : up[x];
  }
  return { ...turn, depth: out };
}

function median(values: number[]): number {
  values.sort((p, q) => p - q);
  return values[values.length >> 1];
}

/** Columns without object take their neighbours' values. */
function fillGaps(line: Float32Array, has: Uint8Array): Float32Array {
  const out = Float32Array.from(line);
  let last = -1;
  for (let x = 0; x < out.length; x++) {
    if (!has[x]) continue;
    for (let k = last + 1; k < x; k++) out[k] = last < 0 ? out[x] : (out[last] + out[x]) / 2;
    last = x;
  }
  for (let k = last + 1; k < out.length; k++) out[k] = last < 0 ? 0 : out[last];
  return out;
}

function blur1d(src: Float32Array, r: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[Math.min(src.length - 1, Math.max(0, i + k))];
    out[i] = sum / (2 * r + 1);
  }
  return out;
}

function median5(src: Float32Array): Float32Array {
  const out = new Float32Array(src.length);
  const win: number[] = [];
  for (let i = 0; i < src.length; i++) {
    win.length = 0;
    for (let k = -2; k <= 2; k++) win.push(src[Math.min(src.length - 1, Math.max(0, i + k))]);
    win.sort((p, q) => p - q);
    out[i] = win[2];
  }
  return out;
}

/** Left and right edge of the moving region (2% and 98% of its mass). */
function maskExtent(mask: Float32Array, w: number, h: number) {
  const columns = new Float32Array(w);
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    columns[i % w] += mask[i];
    total += mask[i];
  }
  let sum = 0;
  let left = 0;
  let right = w - 1;
  for (let x = 0; x < w; x++) {
    const before = sum;
    sum += columns[x];
    if (before < total * 0.02 && sum >= total * 0.02) left = x;
    if (before < total * 0.98 && sum >= total * 0.98) right = x;
  }
  return { left, right };
}

/** Vertical gradient: edges along each column, free of slow shading changes. */
function verticalProfiles(g: Gray): Float32Array {
  const { width: w, height: h, data } = g;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const down = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x++) out[y * w + x] = data[down + x] - data[up + x];
  }
  return out;
}

/**
 * Cost (1 − normalised correlation) of every candidate depth for each column
 * of the object, and how much evidence (contrast) the column has.
 */
function columnCosts(
  pa: Float32Array,
  pb: Float32Array,
  mask: Float32Array,
  w: number,
  h: number,
  angle: number,
  axis: number,
  tilt: number,
  zmax: number,
  every: number,
  cost: Float32Array,
  weight: Float32Array,
) {
  const D = 2 * zmax + 1;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rows: number[] = [];
  for (let x = 0; x < w; x += every) {
    rows.length = 0;
    let sumA = 0;
    let sumAA = 0;
    for (let y = 0; y < h; y++) {
      if (mask[y * w + x] < 0.5) continue;
      rows.push(y);
      const va = pa[y * w + x];
      sumA += va;
      sumAA += va * va;
    }
    const m = rows.length;
    const varA = sumAA - (sumA * sumA) / Math.max(1, m);
    weight[x] = m >= 8 ? Math.sqrt(Math.max(0, varA) / m) : 0;
    const X = x - axis;
    for (let k = 0; k < D; k += every) {
      if (weight[x] === 0) {
        cost[x * D + k] = 1;
        continue;
      }
      const zk = k - zmax;
      const bx = Math.round(x + X * (c - 1) + zk * s);
      if (bx < 0 || bx >= w) {
        cost[x * D + k] = 2;
        continue;
      }
      const dy = -tilt * (X * s + zk * (1 - c));
      let sumB = 0;
      let sumBB = 0;
      let sumAB = 0;
      for (const y of rows) {
        const yb = y + dy;
        const y0 = Math.floor(yb);
        const f = yb - y0;
        const v0 = y0 >= 0 && y0 < h ? pb[y0 * w + bx] : 0;
        const v1 = y0 + 1 >= 0 && y0 + 1 < h ? pb[(y0 + 1) * w + bx] : 0;
        const vb = v0 * (1 - f) + v1 * f;
        const va = pa[y * w + x];
        sumB += vb;
        sumBB += vb * vb;
        sumAB += va * vb;
      }
      const varB = sumBB - (sumB * sumB) / m;
      const cov = sumAB - (sumA * sumB) / m;
      cost[x * D + k] = varB > 1e-6 && varA > 1e-6 ? 1 - cov / Math.sqrt(varA * varB) : 1;
    }
  }
}

/** Mean best cost over textured columns: how well a geometry explains the pair. */
function columnScore(
  pa: Float32Array,
  pb: Float32Array,
  mask: Float32Array,
  w: number,
  h: number,
  angle: number,
  axis: number,
  tilt: number,
  zmax: number,
  every: number,
): number {
  const D = 2 * zmax + 1;
  const cost = new Float32Array(w * D);
  const weight = new Float32Array(w);
  columnCosts(pa, pb, mask, w, h, angle, axis, tilt, zmax, every, cost, weight);
  let sum = 0;
  let total = 0;
  for (let x = 0; x < w; x += every) {
    if (!weight[x]) continue;
    let best = Infinity;
    for (let k = 0; k < D; k += every) best = Math.min(best, cost[x * D + k]);
    sum += best * weight[x];
    total += weight[x];
  }
  return total > 0 ? sum / total : Infinity;
}

/**
 * Where every grid point of a photo has moved after turning by `phi` (of its
 * full `angle`), and — given `near` — how near it then is to the camera.
 */
function shift(turn: Turn, phi: number, du: Float32Array, dv: Float32Array, near?: Float32Array) {
  const { width: w, height: h, axis, tilt, depth, mask } = turn;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  // Photos are taken from slightly above, so the tilt's sign tells which
  // way the object turns, and with it which depths face the camera.
  const facing = Math.sign(tilt);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const X = x - axis;
      const z = depth[i];
      du[i] = (X * (c - 1) + z * s) * mask[i];
      dv[i] = -tilt * (X * s + z * (1 - c)) * mask[i];
      // Still background is behind everything that moves.
      if (near) near[i] = mask[i] > 0.5 ? facing * (z * c - X * s) : -1e6;
    }
  }
}

/** The full motion from this photo to the other one, as an ordinary flow field. */
export function turnFlow(turn: Turn): Flow {
  const u = new Float32Array(turn.width * turn.height);
  const v = new Float32Array(turn.width * turn.height);
  shift(turn, turn.angle, u, v);
  return { width: turn.width, height: turn.height, u, v };
}

/**
 * How far both photos' points travel to reach in-between time `t`: `fromA`
 * turns by t of its angle, `fromB` (the estimate from b back to a) by the rest.
 */
export function turnDisplacement(fromA: Turn, fromB: Turn, t: number): Displacement {
  const n = fromA.width * fromA.height;
  const motion: Displacement = {
    width: fromA.width,
    height: fromA.height,
    duA: new Float32Array(n),
    dvA: new Float32Array(n),
    duB: new Float32Array(n),
    dvB: new Float32Array(n),
  };
  // Which surface is in front is only known when the camera looks down a bit.
  if (Math.abs(fromA.tilt) > 0.07) {
    motion.nearA = new Float32Array(n);
    motion.nearB = new Float32Array(n);
  }
  shift(fromA, t * fromA.angle, motion.duA, motion.dvA, motion.nearA);
  shift(fromB, (1 - t) * fromB.angle, motion.duB, motion.dvB, motion.nearB);
  return motion;
}

function sample(data: Float32Array, w: number, h: number, x: number, y: number): number {
  const cx = Math.min(w - 1, Math.max(0, x));
  const cy = Math.min(h - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const ax = cx - x0;
  const ay = cy - y0;
  return (
    (data[y0 * w + x0] * (1 - ax) + data[y0 * w + x1] * ax) * (1 - ay) +
    (data[y1 * w + x0] * (1 - ax) + data[y1 * w + x1] * ax) * ay
  );
}
