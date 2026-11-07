/** Spins with fewer frames than this look jumpy, so in-between frames are added. */
export const TARGET_FRAMES = 24;
/** Below this, photos are too far apart for in-between frames to look believable. */
export const MIN_PHOTOS = 3;

/**
 * How many frames each photo becomes (itself plus in-betweens), so that the
 * sequence reaches at least TARGET_FRAMES. 1 means nothing is added.
 */
export function framesPerPhoto(photoCount: number): number {
  if (photoCount < MIN_PHOTOS || photoCount >= TARGET_FRAMES) return 1;
  return Math.ceil(TARGET_FRAMES / photoCount);
}

/** Times (0–1, exclusive) of the in-between frames for one pair of photos. */
export function inBetweenTimes(perPhoto: number): number[] {
  return Array.from({ length: Math.max(0, perPhoto - 1) }, (_, i) => (i + 1) / perPhoto);
}
