import { BACKDROP_IDS, type BackdropId } from '../types';

/**
 * Gradients fade fully to `color` by the edges of the frame box (rx ≤ 0.5 and
 * ry ≤ cy), so a letterboxed frame with the gradient baked in blends into the
 * plain `color` around it without a visible seam.
 */
interface RadialGradient {
  /** Centre and radii as fractions of the box, matching CSS `ellipse rx ry at cx cy`. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  stops: [offset: number, color: string][];
}

interface BackdropSpec {
  label: string;
  /** Solid colour, or the colour a gradient fades to (used around letterboxed frames). */
  color: string;
  gradient?: RadialGradient;
}

const SPECS: Record<BackdropId, BackdropSpec> = {
  studio: {
    label: 'Studio',
    color: '#e4e9f0',
    gradient: {
      cx: 0.5,
      cy: 0.45,
      rx: 0.5,
      ry: 0.45,
      stops: [
        [0, '#ffffff'],
        [0.45, '#f5f7fa'],
        [1, '#e4e9f0'],
      ],
    },
  },
  white: { label: 'White', color: '#ffffff' },
  gray: { label: 'Gray', color: '#e2e8f0' },
  dark: {
    label: 'Dark',
    color: '#0a0f1b',
    gradient: {
      cx: 0.5,
      cy: 0.45,
      rx: 0.5,
      ry: 0.45,
      stops: [
        [0, '#2a3a55'],
        [0.5, '#141e33'],
        [1, '#0a0f1b'],
      ],
    },
  },
  transparent: { label: 'Transparent', color: 'transparent' },
};

export const BACKDROPS = BACKDROP_IDS.map((id) => ({ id, label: SPECS[id].label }));

/** CSS `background` for the area directly behind a frame. */
export function backdropCss(id: BackdropId): string {
  const { color, gradient } = SPECS[id] ?? SPECS.studio;
  if (!gradient) return color;
  const stops = gradient.stops.map(([offset, c]) => `${c} ${offset * 100}%`).join(', ');
  return `radial-gradient(ellipse ${gradient.rx * 100}% ${gradient.ry * 100}% at ${gradient.cx * 100}% ${gradient.cy * 100}%, ${stops})`;
}

/** Colour for space around a frame whose aspect ratio differs from its container. */
export function backdropOuterColor(id: BackdropId): string {
  return (SPECS[id] ?? SPECS.studio).color;
}

/**
 * Paints the backdrop exactly as backdropCss() renders it over a box of the
 * same size. Share links bake it into each frame: an opaque WebP is ~4× smaller
 * than one carrying a transparency channel. Returns false for 'transparent'.
 */
export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  id: BackdropId,
  width: number,
  height: number,
): boolean {
  const { color, gradient } = SPECS[id] ?? SPECS.studio;
  if (color === 'transparent') return false;
  if (!gradient) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return true;
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  // Canvas radial gradients are circular: scale a unit circle into the CSS ellipse.
  ctx.translate(gradient.cx * width, gradient.cy * height);
  ctx.scale(gradient.rx * width, gradient.ry * height);
  const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, c] of gradient.stops) fill.addColorStop(offset, c);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
}
