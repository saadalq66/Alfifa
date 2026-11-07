import { describe, expect, it } from 'vitest';
import { luminance, parseHex, toHex } from './scene';

describe('colour helpers', () => {
  it('parses and formats hex colours', () => {
    expect(parseHex('#0ea5e9')).toEqual([14, 165, 233]);
    expect(parseHex('FFFFFF')).toEqual([255, 255, 255]);
    expect(parseHex('red')).toBeNull();
    expect(toHex([14, 165, 233])).toBe('#0ea5e9');
  });

  it('tells light from dark text colours', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBeCloseTo(0);
    expect(luminance('#facc15')).toBeGreaterThan(0.5);
    expect(luminance('#1e3a8a')).toBeLessThan(0.5);
  });
});
