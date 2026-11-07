import { describe, expect, it } from 'vitest';
import { frameTimes, isVideoFile } from './videoFrames';

describe('frameTimes', () => {
  it('spaces frames evenly and leaves out the end of the turn', () => {
    expect(frameTimes(1, 5, 4)).toEqual([1, 2, 3, 4]);
  });

  it('handles an empty or reversed range', () => {
    expect(frameTimes(3, 3, 3)).toEqual([3, 3, 3]);
    expect(frameTimes(5, 2, 2)).toEqual([5, 5]);
  });

  it('always returns at least one frame', () => {
    expect(frameTimes(0, 10, 0)).toEqual([0]);
  });
});

describe('isVideoFile', () => {
  const file = (name: string, type: string) => new File([], name, { type });

  it('recognises videos by type or extension', () => {
    expect(isVideoFile(file('spin.mp4', 'video/mp4'))).toBe(true);
    expect(isVideoFile(file('IMG_0001.MOV', ''))).toBe(true);
    expect(isVideoFile(file('clip.webm', ''))).toBe(true);
  });

  it('rejects images', () => {
    expect(isVideoFile(file('IMG_0001.jpg', 'image/jpeg'))).toBe(false);
  });
});
