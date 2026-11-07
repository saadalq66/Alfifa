import type { BackdropId } from '../types';
import { backdropOuterColor, paintBackdrop } from './backdrops';
import { canvasToBlob, drawToCanvas, fitWithin, loadBlobImage } from './image';

/*
 * A scene is everything drawn around the photos: a background *under* each
 * frame (visible around cut-outs) and text/logo *over* it. One painter renders
 * it for the live viewer, share links, videos and the ZIP export, so they all
 * match.
 */

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TextSize = 'sm' | 'md' | 'lg';

export type SceneBackground =
  | { type: 'preset'; id: BackdropId }
  | { type: 'color'; color: string }
  | { type: 'image'; blob: Blob };

export interface SceneText {
  content: string;
  position: 'top' | 'bottom';
  size: TextSize;
  color: string;
  /** Draw a rounded label behind the text so it stays readable on any background. */
  label: boolean;
}

export interface SceneLogo {
  blob: Blob;
  corner: Corner;
  /** Logo width as a fraction of the frame width. */
  scale: number;
}

export interface Scene {
  background: SceneBackground;
  text: SceneText | null;
  logo: SceneLogo | null;
}

/** A scene with its pictures decoded, so it can be painted synchronously. */
export interface LoadedScene {
  scene: Scene;
  backgroundImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  /** Colour for space around a letterboxed frame; 'transparent' with a transparent background. */
  matte: string;
  transparent: boolean;
}

export const DEFAULT_SCENE: Scene = { background: { type: 'preset', id: 'studio' }, text: null, logo: null };

// Top and bottom-right defaults keep text and logo clear of the viewer's own
// controls (drag hint at the bottom, full-screen button at the top right).
export const DEFAULT_TEXT: SceneText = {
  content: '',
  position: 'top',
  size: 'md',
  color: '#ffffff',
  label: true,
};

const FONT = "'Inter Variable', Inter, system-ui, sans-serif";
const TEXT_SIZES: Record<TextSize, number> = { sm: 0.045, md: 0.065, lg: 0.09 };

export function presetScene(id: BackdropId): LoadedScene {
  return {
    scene: { background: { type: 'preset', id }, text: null, logo: null },
    backgroundImage: null,
    logoImage: null,
    matte: backdropOuterColor(id),
    transparent: id === 'transparent',
  };
}

// Decoded pictures, so editing the caption doesn't re-decode the background and logo.
const decoded = new WeakMap<Blob, Promise<HTMLImageElement>>();
function decode(blob: Blob) {
  let image = decoded.get(blob);
  if (!image) {
    image = loadBlobImage(blob);
    decoded.set(blob, image);
  }
  return image;
}

export async function loadScene(scene: Scene): Promise<LoadedScene> {
  const [backgroundImage, logoImage] = await Promise.all([
    scene.background.type === 'image' ? decode(scene.background.blob) : null,
    scene.logo ? decode(scene.logo.blob) : null,
    // Canvas text silently falls back to another font unless it is loaded first.
    scene.text?.content ? document.fonts?.load(`700 48px ${FONT}`).catch(() => undefined) : null,
  ]);
  const { background } = scene;
  return {
    scene,
    backgroundImage,
    logoImage,
    matte:
      background.type === 'preset'
        ? backdropOuterColor(background.id)
        : background.type === 'color'
          ? background.color
          : averageColor(backgroundImage!),
    transparent: background.type === 'preset' && background.id === 'transparent',
  };
}

/** Paints the background into a frame-sized box. Returns false when it is transparent. */
export function paintUnder(ctx: CanvasRenderingContext2D, loaded: LoadedScene, width: number, height: number) {
  const { background } = loaded.scene;
  if (background.type === 'preset') return paintBackdrop(ctx, background.id, width, height);
  if (background.type === 'color') {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
    return true;
  }
  const image = loaded.backgroundImage!;
  // Cover: fill the box, cropping whichever side overflows.
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  return true;
}

export function hasOverlay(loaded: LoadedScene): boolean {
  return Boolean(loaded.scene.text?.content.trim() || loaded.logoImage);
}

/** Paints text and logo on top of a frame-sized box. */
export function paintOver(ctx: CanvasRenderingContext2D, loaded: LoadedScene, width: number, height: number) {
  const base = Math.min(width, height);
  const margin = base * 0.05;
  const { text, logo } = loaded.scene;

  if (logo && loaded.logoImage) {
    const image = loaded.logoImage;
    let w = width * logo.scale;
    let h = (w * image.naturalHeight) / image.naturalWidth;
    if (h > height * 0.4) {
      h = height * 0.4;
      w = (h * image.naturalWidth) / image.naturalHeight;
    }
    const x = logo.corner.endsWith('left') ? margin : width - margin - w;
    const y = logo.corner.startsWith('top') ? margin : height - margin - h;
    ctx.drawImage(image, x, y, w, h);
  }

  const content = text?.content.trim();
  if (text && content) {
    ctx.save();
    let size = base * TEXT_SIZES[text.size];
    ctx.font = `700 ${size}px ${FONT}`;
    // Shrink long captions to fit instead of running off the edges.
    while (ctx.measureText(content).width > width * 0.86 && size > 6) {
      size *= 0.92;
      ctx.font = `700 ${size}px ${FONT}`;
    }
    const textWidth = ctx.measureText(content).width;
    const padX = text.label ? size * 0.65 : 0;
    const boxHeight = size * (text.label ? 1.75 : 1.3);
    const top = text.position === 'top' ? margin : height - margin - boxHeight;
    const light = luminance(text.color) > 0.5;
    if (text.label) {
      ctx.fillStyle = light ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - textWidth / 2 - padX, top, textWidth + padX * 2, boxHeight, boxHeight / 2);
      ctx.fill();
    } else {
      ctx.shadowColor = light ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = size * 0.25;
    }
    ctx.fillStyle = text.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content, width / 2, top + boxHeight / 2 + size * 0.04);
    ctx.restore();
  }
}

/** Renders one layer as a standalone image, e.g. for the ZIP export. */
export async function renderLayer(
  loaded: LoadedScene,
  layer: 'under' | 'over',
  width: number,
  height: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (layer === 'under') {
    if (!paintUnder(ctx, loaded, width, height)) return null;
  } else {
    if (!hasOverlay(loaded)) return null;
    paintOver(ctx, loaded, width, height);
  }
  return canvasToBlob(canvas, 'image/png');
}

/**
 * Normalises an uploaded background picture or logo: bakes in EXIF rotation,
 * strips metadata and caps the size. Logos keep transparency (PNG); SVG logos
 * are rasterised.
 */
export async function prepareSceneImage(file: Blob, kind: 'background' | 'logo'): Promise<Blob> {
  const image = await loadBlobImage(file);
  const width = image.naturalWidth || 512;
  const height = image.naturalHeight || 512;
  const size = fitWithin(width, height, kind === 'background' ? 2048 : 1024);
  if (kind === 'logo') return canvasToBlob(drawToCanvas(image, size.width, size.height), 'image/png');
  return canvasToBlob(drawToCanvas(image, size.width, size.height, '#ffffff'), 'image/jpeg', 0.9);
}

/** Relative luminance (0–1) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Average colour of a picture, used to letterbox frames that sit on it. */
function averageColor(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return toHex([r, g, b]);
}
