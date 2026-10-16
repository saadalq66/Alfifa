/** Wraps any (possibly negative or fractional) position onto a frame index in [0, count). */
export function wrapIndex(position: number, count: number): number {
  if (count <= 0) return 0;
  const index = Math.round(position) % count;
  return index < 0 ? index + count : index;
}

/**
 * Signed number of frames to travel from `from` to `to` around the loop,
 * choosing the shorter direction (e.g. 35 → 0 with 36 frames is +1, not −35).
 */
export function shortestDelta(from: number, to: number, count: number): number {
  if (count <= 0) return 0;
  let delta = (to - from) % count;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return delta;
}

/**
 * How many horizontal pixels of dragging advance one frame. Dragging across the
 * full width of the viewer spins the object one full turn, but very long
 * sequences never drop below `minPx` so small hand movements stay controllable.
 */
export function pixelsPerFrame(viewportWidth: number, count: number, minPx = 3): number {
  if (count <= 0) return minPx;
  return Math.max(minPx, viewportWidth / count);
}

/** Default auto-rotate speed: one full turn in roughly five seconds. */
export function defaultFps(count: number): number {
  return clamp(Math.round(count / 5), 6, 30);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface Sample {
  t: number;
  x: number;
}

/** Pointer velocity in px/ms over the most recent `windowMs` of samples. */
export function recentVelocity(samples: readonly Sample[], windowMs = 90): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}
