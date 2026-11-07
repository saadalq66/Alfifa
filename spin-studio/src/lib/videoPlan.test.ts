import { describe, expect, it } from 'vitest';
import { planVideo, videoSize } from './videoPlan';

describe('planVideo', () => {
  it('holds every photo for the same number of video frames', () => {
    // 7 fps → hold 4 frames (7.5 fps effective) instead of mixing 4- and 5-frame holds.
    const plan = planVideo(36, 7, 2);
    expect(plan.hold).toBe(4);
    expect(plan.totalFrames).toBe(36 * 2 * 4);
    expect(plan.turnDuration).toBeCloseTo(4.8);
    expect(plan.duration).toBeCloseTo(9.6);
  });

  it('never holds a photo for less than one frame', () => {
    expect(planVideo(72, 60, 1).hold).toBe(1);
  });

  it('copes with degenerate input', () => {
    const plan = planVideo(0, 0, 0);
    expect(plan.totalFrames).toBeGreaterThan(0);
    expect(plan.hold).toBe(30);
  });
});

describe('videoSize', () => {
  it('scales the short edge to the target', () => {
    expect(videoSize(1600, 1200, 1080)).toEqual({ width: 1440, height: 1080 });
    expect(videoSize(1200, 1600, 720)).toEqual({ width: 720, height: 960 });
  });

  it('never upscales the source photos', () => {
    expect(videoSize(1600, 900, 1080)).toEqual({ width: 1600, height: 900 });
  });

  it('keeps dimensions even for H.264', () => {
    const { width, height } = videoSize(1001, 667, 1080);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});
