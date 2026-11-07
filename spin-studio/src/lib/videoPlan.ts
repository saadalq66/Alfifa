/** Output frame rate. 30 fps is accepted by every player and social platform. */
export const VIDEO_FPS = 30;

export interface VideoPlan {
  /** How many output frames each photo is shown for. Uniform holds avoid judder. */
  hold: number;
  totalFrames: number;
  /** Seconds. */
  duration: number;
  /** Seconds for one full turn. */
  turnDuration: number;
}

/**
 * Maps the spin onto a constant 30 fps timeline. Every photo is held for the
 * same whole number of video frames (alternating 4- and 5-frame holds would
 * make the rotation stutter), so the speed is rounded to the nearest rate that
 * divides 30 fps evenly.
 */
export function planVideo(frameCount: number, spinFps: number, turns: number): VideoPlan {
  const hold = Math.max(1, Math.round(VIDEO_FPS / Math.max(1, spinFps)));
  const totalFrames = Math.max(1, frameCount) * Math.max(1, turns) * hold;
  const turnDuration = (Math.max(1, frameCount) * hold) / VIDEO_FPS;
  return { hold, totalFrames, duration: totalFrames / VIDEO_FPS, turnDuration };
}

/**
 * Output size for a frame aspect ratio: `shortEdge` on the shorter side, never
 * upscaling the source photos, with even dimensions as H.264 requires.
 */
export function videoSize(frameWidth: number, frameHeight: number, shortEdge: number) {
  const scale = Math.min(1, shortEdge / Math.min(frameWidth, frameHeight));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(frameWidth), height: even(frameHeight) };
}
