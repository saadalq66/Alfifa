import type { Flow, RGBAImage } from './flow';

/*
 * A textured box on a turntable, rendered exactly (orthographic camera tilted
 * down), for tests: any angle can be rendered, and the true motion of every
 * pixel between two angles is known.
 */

type V3 = [number, number, number];

export const SCENE = { width: 240, height: 180, tilt: (17 * Math.PI) / 180 };
const BOX = { w: 1, d: 0.72, h: 1.32 };
const FACES: { o: V3; u: V3; v: V3; n: V3; tint: V3 }[] = [
  { o: [-BOX.w / 2, BOX.h / 2, BOX.d / 2], u: [BOX.w, 0, 0], v: [0, -BOX.h, 0], n: [0, 0, 1], tint: [40, 90, 200] },
  { o: [BOX.w / 2, BOX.h / 2, BOX.d / 2], u: [0, 0, -BOX.d], v: [0, -BOX.h, 0], n: [1, 0, 0], tint: [230, 120, 40] },
  { o: [BOX.w / 2, BOX.h / 2, -BOX.d / 2], u: [-BOX.w, 0, 0], v: [0, -BOX.h, 0], n: [0, 0, -1], tint: [40, 160, 90] },
  { o: [-BOX.w / 2, BOX.h / 2, -BOX.d / 2], u: [0, 0, BOX.d], v: [0, -BOX.h, 0], n: [-1, 0, 0], tint: [200, 60, 120] },
  { o: [-BOX.w / 2, BOX.h / 2, -BOX.d / 2], u: [BOX.w, 0, 0], v: [0, 0, BOX.d], n: [0, 1, 0], tint: [30, 30, 50] },
];

function camera() {
  const { width, height, tilt } = SCENE;
  const cosE = Math.cos(tilt);
  const sinE = Math.sin(tilt);
  const radius = Math.hypot(BOX.w / 2, BOX.d / 2);
  const scale = Math.min((width * 0.42) / (2 * radius), (height * 0.7) / (BOX.h * cosE + 2 * radius * sinE));
  return { cosE, sinE, scale, cx: width / 2, cy: height * 0.48 };
}

const rotate = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Turntable x position of the axis in the picture. */
export const AXIS_X = SCENE.width / 2;

/** The surface point (in box coordinates) seen at pixel (x, y) when the box is turned by `angle`. */
function hit(x: number, y: number, angle: number): { p: V3; face: number; s: number; t: number } | null {
  const { cosE, sinE, scale, cx, cy } = camera();
  const view: V3 = [0, sinE, cosE];
  let best = -Infinity;
  let found: { p: V3; face: number; s: number; t: number } | null = null;
  FACES.forEach((f, face) => {
    if (dot(rotate(f.n, angle), view) <= 1e-3) return;
    const project = (p: V3) => {
      const r = rotate(p, angle);
      return [r[0] * scale, -(r[1] * cosE - r[2] * sinE) * scale];
    };
    const [ox, oy] = project(f.o);
    const [ux, uy] = project(f.u);
    const [vx, vy] = project(f.v);
    const det = ux * vy - uy * vx;
    const dx = x - cx - ox;
    const dy = y - cy - oy;
    const s = (dx * vy - dy * vx) / det;
    const t = (ux * dy - uy * dx) / det;
    if (s < 0 || s > 1 || t < 0 || t > 1) return;
    const p: V3 = [f.o[0] + s * f.u[0] + t * f.v[0], f.o[1] + s * f.u[1] + t * f.v[1], f.o[2] + s * f.u[2] + t * f.v[2]];
    const depth = dot(rotate(p, angle), view);
    if (depth > best) {
      best = depth;
      found = { p, face, s, t };
    }
  });
  return found;
}

function hash(a: number, b: number): number {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** The box turned by `angle` (radians). The background is light grey, or transparent. */
export function renderBox(angle: number, transparent = false): RGBAImage {
  const { width, height } = SCENE;
  const data = new Uint8ClampedArray(width * height * 4);
  const light: V3 = [-0.45, 0.75, 0.55];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const h = hit(x + 0.5, y + 0.5, angle);
      if (!h) {
        data[o] = data[o + 1] = data[o + 2] = 235;
        data[o + 3] = transparent ? 0 : 255;
        continue;
      }
      // Random tiles: texture that is unique, so matches are unambiguous.
      const noise = hash(Math.floor(h.s * 14) + h.face * 100, Math.floor(h.t * 18));
      const shade = 0.55 + 0.45 * Math.max(0, dot(rotate(FACES[h.face].n, angle), light) / Math.hypot(...light));
      const tint = FACES[h.face].tint;
      for (let c = 0; c < 3; c++) data[o + c] = (tint[c] * 0.5 + noise * 160) * shade;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Exact motion of every pixel of the box from `from` to `to` (radians); 0 off the box. */
export function trueMotion(from: number, to: number): Flow & { onBox: Uint8Array } {
  const { width, height } = SCENE;
  const { cosE, sinE, scale, cx, cy } = camera();
  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);
  const onBox = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = hit(x + 0.5, y + 0.5, from);
      if (!h) continue;
      const r = rotate(h.p, to);
      const i = y * width + x;
      u[i] = cx + r[0] * scale - (x + 0.5);
      v[i] = cy - (r[1] * cosE - r[2] * sinE) * scale - (y + 0.5);
      onBox[i] = 1;
    }
  }
  return { width, height, u, v, onBox };
}
