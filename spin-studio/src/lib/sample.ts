import { canvasToBlob } from './image';

/*
 * Renders a product box on a turntable at evenly spaced angles, so the hero has
 * a live demo and people can try the studio without photos of their own.
 * Orthographic projection maps every box face to a parallelogram, which canvas
 * can draw exactly with a single affine transform.
 */

type Vec3 = [number, number, number];

const W = 1;
const D = 0.72;
const H = 1.32;
const TEX_SCALE = 400;
const ELEVATION = 0.3;
const LIGHT = normalize([-0.45, 0.75, 0.55]);
const FONT = "'Inter Variable', Inter, system-ui, sans-serif";

interface Face {
  texture: HTMLCanvasElement;
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
}

export async function renderSampleFrames(
  count: number,
  width: number,
  height: number,
  quality = 0.9,
): Promise<Blob[]> {
  await document.fonts?.ready;
  const faces = buildFaces();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const blobs: Blob[] = [];
  for (let i = 0; i < count; i++) {
    drawFrame(ctx, width, height, faces, (i / count) * Math.PI * 2);
    blobs.push(await canvasToBlob(canvas, 'image/jpeg', quality));
  }
  return blobs;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  faces: Face[],
  angle: number,
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cosE = Math.cos(ELEVATION);
  const sinE = Math.sin(ELEVATION);
  const radius = Math.hypot(W / 2, D / 2);
  const scale = Math.min(
    (width * 0.48) / (2 * radius),
    (height * 0.68) / (H * cosE + 2 * radius * sinE),
  );
  const cx = width / 2;
  const cy = height * 0.47;

  const rotate = ([x, y, z]: Vec3): Vec3 => [x * cos + z * sin, y, -x * sin + z * cos];
  const project = (p: Vec3): [number, number] => {
    const [x, y, z] = rotate(p);
    return [cx + x * scale, cy - (y * cosE - z * sinE) * scale];
  };
  const projectVector = (v: Vec3): [number, number] => {
    const [x, y, z] = rotate(v);
    return [x * scale, -(y * cosE - z * sinE) * scale];
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, '#ffffff');
  backdrop.addColorStop(1, '#e8ecf2');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  // Soft contact shadow on the turntable.
  const [sx, sy] = project([0, -H / 2, 0]);
  const rx = radius * scale * 1.3;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, sinE * 1.1);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  shadow.addColorStop(0, 'rgba(15, 23, 42, 0.34)');
  shadow.addColorStop(0.55, 'rgba(15, 23, 42, 0.12)');
  shadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const camera: Vec3 = [0, sinE, cosE];
  const visible = faces.filter((face) => dot(rotate(face.normal), camera) > 1e-3);

  const corners = (face: Face) =>
    [
      face.origin,
      add(face.origin, face.u),
      add(add(face.origin, face.u), face.v),
      add(face.origin, face.v),
    ].map(project);

  // A dark under-fill hides anti-aliasing seams between adjacent faces.
  for (const face of visible) {
    tracePolygon(ctx, corners(face));
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();
  }

  for (const face of visible) {
    const [ox, oy] = project(face.origin);
    const [ux, uy] = projectVector(face.u);
    const [vx, vy] = projectVector(face.v);
    const tw = face.texture.width;
    const th = face.texture.height;
    ctx.setTransform(ux / tw, uy / tw, vx / th, vy / th, ox, oy);
    ctx.drawImage(face.texture, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const light = Math.max(0, dot(rotate(face.normal), LIGHT));
    const shade = (1 - (0.6 + 0.4 * light)) * 0.85;
    tracePolygon(ctx, corners(face));
    ctx.fillStyle = `rgba(2, 6, 23, ${shade.toFixed(3)})`;
    ctx.fill();
  }

  // Thin highlight along the lid edges sells the 3D shape.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  for (const face of visible) {
    if (face.normal[1] !== 0) continue;
    const [a, b] = corners(face);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

function buildFaces(): Face[] {
  const px = (units: number) => Math.round(units * TEX_SCALE);
  return [
    {
      texture: texture(px(W), px(H), drawFront),
      origin: [-W / 2, H / 2, D / 2],
      u: [W, 0, 0],
      v: [0, -H, 0],
      normal: [0, 0, 1],
    },
    {
      texture: texture(px(D), px(H), drawRight),
      origin: [W / 2, H / 2, D / 2],
      u: [0, 0, -D],
      v: [0, -H, 0],
      normal: [1, 0, 0],
    },
    {
      texture: texture(px(W), px(H), drawBack),
      origin: [W / 2, H / 2, -D / 2],
      u: [-W, 0, 0],
      v: [0, -H, 0],
      normal: [0, 0, -1],
    },
    {
      texture: texture(px(D), px(H), drawLeft),
      origin: [-W / 2, H / 2, -D / 2],
      u: [0, 0, D],
      v: [0, -H, 0],
      normal: [-1, 0, 0],
    },
    {
      texture: texture(px(W), px(D), drawTop),
      origin: [-W / 2, H / 2, -D / 2],
      u: [W, 0, 0],
      v: [0, 0, D],
      normal: [0, 1, 0],
    },
  ];
}

function texture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d')!, width, height);
  return canvas;
}

function drawFront(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `700 15px ${FONT}`;
  ctx.letterSpacing = '4px';
  ctx.fillText('SPIN STUDIO', 44, 66);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '-4px';
  ctx.font = `800 128px ${FONT}`;
  ctx.fillText('360°', w / 2, h * 0.52);
  ctx.letterSpacing = '6px';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('SAMPLE PRODUCT', w / 2, h * 0.52 + 44);

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.8, 92, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(w / 2 + 92, h * 0.8, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawRight(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fb923c');
  bg.addColorStop(1, '#ea580c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 22;
  for (let x = -h; x < w + h; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(w / 2 + 26, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.letterSpacing = '10px';
  ctx.font = `800 70px ${FONT}`;
  ctx.fillText('ROTATE', 0, 0);
  ctx.restore();
}

function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 34px ${FONT}`;
  ctx.letterSpacing = '-0.5px';
  ctx.fillText('Spin Studio', 40, 80);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(40, 100, 64, 6);

  ctx.fillStyle = '#cbd5e1';
  const lines = [0.86, 0.72, 0.8, 0.64, 0.78, 0.5];
  lines.forEach((length, i) => {
    roundRect(ctx, 40, 140 + i * 30, (w - 80) * length, 12, 6);
    ctx.fill();
  });

  // Barcode
  let x = 40;
  let seed = 7;
  ctx.fillStyle = '#0f172a';
  while (x < 250) {
    seed = (seed * 9301 + 49297) % 233280;
    const bar = 2 + Math.floor((seed / 233280) * 5);
    ctx.fillRect(x, h - 150, bar, 84);
    x += bar + 3;
  }
  ctx.font = `600 16px ${FONT}`;
  ctx.letterSpacing = '5px';
  ctx.fillText('360-00172-8', 40, h - 44);
}

function drawLeft(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#38bdf8');
  bg.addColorStop(1, '#0369a1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, 40 + i * 34, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 - i * 0.1})`;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.3, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.letterSpacing = '5px';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText('SHARE', w / 2, h * 0.68);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('EMBED', w / 2, h * 0.68 + 42);
}

function drawTop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('360', w / 2, h / 2 + 2);
}

function tracePolygon(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
}
