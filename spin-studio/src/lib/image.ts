export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image.'));
    img.src = src;
  });
}

/** Decodes a blob through an <img>, which applies EXIF orientation in every modern browser. */
export async function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    await img.decode().catch(() => undefined);
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  background?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
      type,
      quality,
    );
  });
}

let webpSupport: Promise<boolean> | undefined;

/** Some browsers silently fall back to PNG when asked to encode WebP. */
export function supportsWebpEncoding(): Promise<boolean> {
  webpSupport ??= (async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const blob = await canvasToBlob(canvas, 'image/webp', 0.8);
      return blob.type === 'image/webp';
    } catch {
      return false;
    }
  })();
  return webpSupport;
}

/** Small preview used by the sequence grid, so it never decodes full-size frames. */
export async function makeThumbnailUrl(
  source: HTMLImageElement,
  maxEdge: number,
  hasAlpha: boolean,
): Promise<string> {
  const size = fitWithin(source.naturalWidth, source.naturalHeight, maxEdge);
  const canvas = drawToCanvas(source, size.width, size.height);
  let blob: Blob;
  if (!hasAlpha) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
  } else if (await supportsWebpEncoding()) {
    blob = await canvasToBlob(canvas, 'image/webp', 0.82);
  } else {
    blob = await canvasToBlob(canvas, 'image/png');
  }
  return URL.createObjectURL(blob);
}
