import { describe, expect, it } from 'vitest';
import { framesPerPhoto, inBetweenTimes } from './plan';

describe('framesPerPhoto', () => {
  it('fills short sequences up to at least 24 frames', () => {
    expect(framesPerPhoto(8)).toBe(3);
    expect(framesPerPhoto(8) * 8).toBeGreaterThanOrEqual(24);
    expect(framesPerPhoto(10) * 10).toBeGreaterThanOrEqual(24);
    expect(framesPerPhoto(23)).toBe(2);
  });

  it('leaves long sequences and too few photos alone', () => {
    expect(framesPerPhoto(24)).toBe(1);
    expect(framesPerPhoto(36)).toBe(1);
    expect(framesPerPhoto(2)).toBe(1);
  });
});

describe('inBetweenTimes', () => {
  it('spaces in-between frames evenly between two photos', () => {
    expect(inBetweenTimes(3)).toEqual([1 / 3, 2 / 3]);
    expect(inBetweenTimes(1)).toEqual([]);
  });
});
