import { describe, expect, it } from 'vitest';
import {
  decodeSharePayload,
  encodeSharePayload,
  fromBase64Url,
  readShareHash,
  ShareLinkError,
  toBase64Url,
  type SharePayload,
} from './sharePayload';

function randomBytes(length: number, seed: number) {
  const out = new Uint8Array(length);
  let x = seed;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

const payload: SharePayload = {
  autoplay: true,
  invertDrag: false,
  backdrop: 'dark',
  fps: 12,
  format: 'image/webp',
  frames: [randomBytes(10, 1), randomBytes(300, 2), randomBytes(70_000, 3)],
};

describe('base64url', () => {
  it('round-trips every length remainder', () => {
    for (let length = 0; length < 40; length++) {
      const bytes = randomBytes(length, length + 7);
      const text = toBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(fromBase64Url(text))).toEqual(Array.from(bytes));
    }
  });

  it('matches the standard encoding', () => {
    const bytes = randomBytes(1000, 42);
    const standard = Buffer.from(bytes).toString('base64url');
    expect(toBase64Url(bytes)).toBe(standard);
  });

  it('accepts standard base64 with padding', () => {
    const bytes = randomBytes(31, 9);
    const standard = Buffer.from(bytes).toString('base64');
    expect(Array.from(fromBase64Url(standard))).toEqual(Array.from(bytes));
  });

  it('rejects invalid characters', () => {
    expect(() => fromBase64Url('abc$')).toThrow();
  });
});

describe('share payload', () => {
  it('round-trips settings and frames', () => {
    const decoded = decodeSharePayload(encodeSharePayload(payload));
    expect(decoded.autoplay).toBe(true);
    expect(decoded.invertDrag).toBe(false);
    expect(decoded.backdrop).toBe('dark');
    expect(decoded.fps).toBe(12);
    expect(decoded.format).toBe('image/webp');
    expect(decoded.frames.map((f) => f.length)).toEqual([10, 300, 70_000]);
    expect(Array.from(decoded.frames[2].subarray(0, 50))).toEqual(
      Array.from(payload.frames[2].subarray(0, 50)),
    );
  });

  it('adds only a few bytes of overhead on top of the images', () => {
    const encoded = encodeSharePayload(payload);
    const imageBytes = 10 + 300 + 70_000;
    expect(encoded.length).toBeLessThan(Math.ceil(((imageBytes + 16) * 4) / 3));
  });

  it('detects links that were cut off', () => {
    const encoded = encodeSharePayload(payload);
    expect(() => decodeSharePayload(encoded.slice(0, encoded.length - 100))).toThrow(ShareLinkError);
    expect(() => decodeSharePayload(encoded.slice(0, 4))).toThrow(ShareLinkError);
  });

  it('rejects garbage', () => {
    expect(() => decodeSharePayload('')).toThrow(ShareLinkError);
    expect(() => decodeSharePayload('not a link!')).toThrow(ShareLinkError);
    expect(() => decodeSharePayload(toBase64Url(new Uint8Array([9, 0, 0, 0, 0, 1])))).toThrow(
      ShareLinkError,
    );
  });

  it('reads the hash prefix', () => {
    expect(readShareHash('#spin=abc')).toBe('abc');
    expect(readShareHash('#studio')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });
});
