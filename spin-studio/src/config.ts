export const APP_NAME = 'Spin Studio';

/**
 * Imported photos are scaled down to this long edge. It keeps scrubbing smooth
 * (dozens of decoded frames stay in memory), background removal fast, and is
 * still sharp on large retina viewports.
 */
export const MAX_FRAME_EDGE = 1600;

export const THUMB_EDGE = 320;

/** Hard cap on frames per project, to keep memory use sane on phones. */
export const MAX_FRAMES = 180;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Where @imgly/background-removal downloads its model and WASM files from.
 * Leave unset to use IMG.LY's CDN, or point it at a self-hosted copy of
 * @imgly/background-removal-data (must end with a slash).
 */
export const BG_REMOVAL_PUBLIC_PATH: string | undefined =
  import.meta.env.VITE_BG_REMOVAL_PUBLIC_PATH || undefined;
