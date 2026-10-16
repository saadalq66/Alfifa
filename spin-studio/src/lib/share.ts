import type { BackdropId } from '../types';
import { paintBackdrop } from './backdrops';
import { canvasToBlob, fitWithin, loadBlobImage, supportsWebpEncoding } from './image';
import {
  encodeSharePayload,
  SHARE_HASH_PREFIX,
  type ShareImageFormat,
  type SharePayload,
} from './sharePayload';

export type SharePresetId = 'small' | 'balanced' | 'sharp';

export const SHARE_PRESETS: {
  id: SharePresetId;
  label: string;
  hint: string;
  maxEdge: number;
  quality: number;
}[] = [
  { id: 'small', label: 'Small', hint: 'Shortest link', maxEdge: 360, quality: 0.5 },
  { id: 'balanced', label: 'Balanced', hint: 'Good for most uses', maxEdge: 540, quality: 0.6 },
  { id: 'sharp', label: 'Sharp', hint: 'Best quality', maxEdge: 800, quality: 0.72 },
];

/** Above this many characters some browsers refuse to open a URL. */
export const URL_HARD_LIMIT = 2_000_000;
/** Above this, links get unwieldy for chat apps and social sites; embeds are still fine. */
export const URL_SOFT_LIMIT = 500_000;

export interface ShareFrames {
  format: ShareImageFormat;
  frames: Uint8Array[];
  width: number;
  height: number;
}

/**
 * Re-encodes frames small enough to travel inside a URL. Unless the backdrop is
 * transparent it is painted into every frame: an opaque WebP is about a quarter
 * the size of one with an alpha channel, and the viewer lines the baked
 * backdrop up with its own (see SpinViewer).
 */
export async function encodeShareFrames(
  sources: Blob[],
  presetId: SharePresetId,
  backdrop: BackdropId,
): Promise<ShareFrames> {
  const preset = SHARE_PRESETS.find((p) => p.id === presetId) ?? SHARE_PRESETS[1];
  // WebP keeps transparency and is far smaller than JPEG at the same quality.
  const format: ShareImageFormat = (await supportsWebpEncoding()) ? 'image/webp' : 'image/jpeg';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const frames: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  for (const source of sources) {
    const image = await decode(source);
    const size = fitWithin(image.width, image.height, preset.maxEdge);
    if (!width) ({ width, height } = size);
    canvas.width = size.width;
    canvas.height = size.height;
    if (!paintBackdrop(ctx, backdrop, size.width, size.height) && format === 'image/jpeg') {
      // JPEG has no transparency; fall back to white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source, 0, 0, size.width, size.height);
    image.close();
    const blob = await canvasToBlob(canvas, format, preset.quality);
    frames.push(new Uint8Array(await blob.arrayBuffer()));
  }
  return { format, frames, width, height };
}

async function decode(blob: Blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const img = await loadBlobImage(blob);
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
}

export function buildShareUrl(payload: SharePayload, base = currentAppUrl()): string {
  return `${base}${SHARE_HASH_PREFIX}${encodeSharePayload(payload)}`;
}

/** The URL of this app without any hash — works on a domain root or a GitHub Pages sub-path. */
export function currentAppUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function buildEmbedCode(url: string, width: number, height: number): string {
  const ratio = width && height ? `${width} / ${height}` : '4 / 3';
  return [
    `<iframe src="${escapeAttribute(url)}"`,
    ` title="Interactive 360° view" width="100%"`,
    ` style="aspect-ratio: ${ratio}; max-width: 720px; border: 0; border-radius: 16px;"`,
    ` loading="lazy" allow="fullscreen" allowfullscreen></iframe>`,
  ].join('');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
