import { ACCEPTED_TYPES, MAX_FRAME_EDGE, THUMB_EDGE } from '../config';
import type { Cutout, Frame } from '../types';
import { canvasToBlob, drawToCanvas, fitWithin, loadBlobImage, makeThumbnailUrl } from './image';

export function createId(): string {
  // randomUUID is unavailable on plain-http LAN dev servers.
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Orders "IMG_2.jpg" before "IMG_10.jpg", the way cameras number their shots. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

/** Decodes a photo, scales it to the working resolution and builds its thumbnail. */
export async function importPhoto(file: Blob, name: string): Promise<Frame> {
  const img = await loadBlobImage(file);
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight) throw new Error(`${name} is empty or corrupted.`);

  const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const size = fitWithin(naturalWidth, naturalHeight, MAX_FRAME_EDGE);

  // Always re-encode: it bakes EXIF rotation into the pixels (so the worker and
  // exports see an upright image) and strips metadata such as GPS location
  // before frames end up in share links or ZIPs.
  const canvas = drawToCanvas(img, size.width, size.height);
  const blob = keepsAlpha
    ? await canvasToBlob(canvas, 'image/png')
    : await canvasToBlob(canvas, 'image/jpeg', 0.92);

  return {
    id: createId(),
    name,
    width: size.width,
    height: size.height,
    blob,
    url: URL.createObjectURL(blob),
    thumbUrl: await makeThumbnailUrl(img, THUMB_EDGE, keepsAlpha),
    bg: { status: 'idle', progress: 0 },
  };
}

export async function createCutout(blob: Blob): Promise<Cutout> {
  const img = await loadBlobImage(blob);
  return {
    blob,
    url: URL.createObjectURL(blob),
    thumbUrl: await makeThumbnailUrl(img, THUMB_EDGE, true),
  };
}

export function revokeCutout(cutout: Cutout | undefined) {
  if (!cutout) return;
  URL.revokeObjectURL(cutout.url);
  URL.revokeObjectURL(cutout.thumbUrl);
}

export function revokeFrame(frame: Frame) {
  URL.revokeObjectURL(frame.url);
  URL.revokeObjectURL(frame.thumbUrl);
  revokeCutout(frame.cutout);
}

/** The image the viewer shows for a frame: the cutout when background removal is on. */
export function displayBlob(frame: Frame, removeBackgrounds: boolean): Blob {
  return removeBackgrounds && frame.cutout ? frame.cutout.blob : frame.blob;
}

export function displayUrl(frame: Frame, removeBackgrounds: boolean): string {
  return removeBackgrounds && frame.cutout ? frame.cutout.url : frame.url;
}
