import { describe, expect, it } from 'vitest';
import { defaultFps, pixelsPerFrame, recentVelocity, shortestDelta, wrapIndex } from './spinMath';

describe('wrapIndex', () => {
  it('wraps positions in both directions', () => {
    expect(wrapIndex(0, 36)).toBe(0);
    expect(wrapIndex(36, 36)).toBe(0);
    expect(wrapIndex(37.2, 36)).toBe(1);
    expect(wrapIndex(-1, 36)).toBe(35);
    expect(wrapIndex(-36.6, 36)).toBe(35);
  });

  it('rounds fractional positions to the nearest frame', () => {
    expect(wrapIndex(2.49, 10)).toBe(2);
    expect(wrapIndex(2.5, 10)).toBe(3);
  });

  it('handles empty sequences', () => {
    expect(wrapIndex(5, 0)).toBe(0);
  });
});

describe('shortestDelta', () => {
  it('goes the short way around the loop', () => {
    expect(shortestDelta(35, 0, 36)).toBe(1);
    expect(shortestDelta(1, 35, 36)).toBe(-2);
    expect(shortestDelta(10, 4, 36)).toBe(-6);
    expect(shortestDelta(0, 0, 36)).toBe(0);
  });

  it('works with fractional and unwrapped positions', () => {
    expect(shortestDelta(71.5, 0, 36)).toBeCloseTo(0.5);
    expect(shortestDelta(-2, 0, 36)).toBe(2);
  });
});

describe('pixelsPerFrame', () => {
  it('maps the viewer width to one full turn', () => {
    expect(pixelsPerFrame(720, 36)).toBe(20);
  });

  it('never goes below the minimum', () => {
    expect(pixelsPerFrame(300, 200, 3)).toBe(3);
  });
});

describe('defaultFps', () => {
  it('targets a ~5s turn within sane bounds', () => {
    expect(defaultFps(36)).toBe(7);
    expect(defaultFps(8)).toBe(6);
    expect(defaultFps(400)).toBe(30);
  });
});

describe('recentVelocity', () => {
  it('measures only the recent window', () => {
    const samples = [
      { t: 0, x: 0 },
      { t: 500, x: 10 },
      { t: 550, x: 60 },
      { t: 600, x: 110 },
    ];
    expect(recentVelocity(samples, 100)).toBeCloseTo(1);
  });

  it('is zero without movement data', () => {
    expect(recentVelocity([{ t: 0, x: 0 }])).toBe(0);
  });
});
