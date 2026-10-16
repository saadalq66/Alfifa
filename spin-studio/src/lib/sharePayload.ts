import { BACKDROP_IDS, type BackdropId } from '../types';

/**
 * Share links carry the whole project inside the URL fragment (`#spin=…`), so
 * no server or database is involved — and fragments are never sent to the
 * host serving the page.
 *
 * The frames are already-compressed WebP/JPEG bytes, which general-purpose
 * compressors (lz-string, deflate) cannot shrink further — they only add
 * overhead. So the payload is a compact binary container encoded as base64url,
 * the densest URL-safe text encoding. Size is controlled where it matters:
 * frame resolution, quality and count (see share.ts).
 *
 * Layout (version 1):
 *   u8      version
 *   u8      flags (bit 0: autoplay, bit 1: invert drag)
 *   u8      backdrop index into BACKDROP_IDS
 *   u8      auto-rotate fps
 *   u8      image format index into FORMATS
 *   varint  frame count
 *   repeated: varint byte length, bytes
 */

export const SHARE_HASH_PREFIX = '#spin=';
const VERSION = 1;
const FORMATS = ['image/webp', 'image/jpeg', 'image/png'] as const;
export type ShareImageFormat = (typeof FORMATS)[number];

export const MAX_SHARE_FRAMES = 360;
const MAX_FRAME_BYTES = 4 * 1024 * 1024;

export interface SharePayload {
  autoplay: boolean;
  invertDrag: boolean;
  backdrop: BackdropId;
  fps: number;
  format: ShareImageFormat;
  frames: Uint8Array[];
}

export class ShareLinkError extends Error {
  override name = 'ShareLinkError';
}

export function encodeSharePayload(payload: SharePayload): string {
  const formatIndex = FORMATS.indexOf(payload.format);
  const backdropIndex = BACKDROP_IDS.indexOf(payload.backdrop);
  if (formatIndex < 0) throw new Error(`Unsupported format ${payload.format}`);
  if (payload.frames.length === 0 || payload.frames.length > MAX_SHARE_FRAMES) {
    throw new Error(`A share link needs 1–${MAX_SHARE_FRAMES} frames`);
  }

  const header = [
    VERSION,
    (payload.autoplay ? 1 : 0) | (payload.invertDrag ? 2 : 0),
    Math.max(0, backdropIndex),
    Math.round(Math.min(60, Math.max(1, payload.fps))),
    formatIndex,
    ...varint(payload.frames.length),
  ];
  let size = header.length;
  for (const frame of payload.frames) size += varint(frame.length).length + frame.length;

  const bytes = new Uint8Array(size);
  bytes.set(header, 0);
  let offset = header.length;
  for (const frame of payload.frames) {
    const length = varint(frame.length);
    bytes.set(length, offset);
    offset += length.length;
    bytes.set(frame, offset);
    offset += frame.length;
  }
  return toBase64Url(bytes);
}

export function decodeSharePayload(encoded: string): SharePayload {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(encoded);
  } catch {
    throw new ShareLinkError('The link contains invalid characters.');
  }
  const reader = new Reader(bytes);

  const version = reader.byte();
  if (version !== VERSION) {
    throw new ShareLinkError('This link was made with a newer version of the app.');
  }
  const flags = reader.byte();
  const backdrop = BACKDROP_IDS[reader.byte()] ?? 'studio';
  const fps = Math.min(60, Math.max(1, reader.byte()));
  const format = FORMATS[reader.byte()];
  if (!format) throw new ShareLinkError('Unknown image format.');

  const count = reader.varint();
  if (count < 1 || count > MAX_SHARE_FRAMES) throw new ShareLinkError('Invalid frame count.');

  const frames: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const length = reader.varint();
    if (length > MAX_FRAME_BYTES) throw new ShareLinkError('Invalid frame size.');
    frames.push(reader.bytes(length));
  }

  return {
    autoplay: (flags & 1) !== 0,
    invertDrag: (flags & 2) !== 0,
    backdrop,
    fps,
    format,
    frames,
  };
}

/** Extracts the encoded payload from a location hash, or null if it is not a share link. */
export function readShareHash(hash: string): string | null {
  return hash.startsWith(SHARE_HASH_PREFIX) ? hash.slice(SHARE_HASH_PREFIX.length) : null;
}

class Reader {
  private offset = 0;
  constructor(private readonly data: Uint8Array) {}

  byte(): number {
    if (this.offset >= this.data.length) throw truncated();
    return this.data[this.offset++];
  }

  varint(): number {
    let result = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const b = this.byte();
      result += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) return result;
    }
    throw new ShareLinkError('Malformed link data.');
  }

  bytes(length: number): Uint8Array {
    if (this.offset + length > this.data.length) throw truncated();
    const slice = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}

function truncated() {
  return new ShareLinkError(
    'This link is incomplete — it was probably cut off when it was copied or sent.',
  );
}

function varint(value: number): number[] {
  const out: number[] = [];
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
  return out;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;

export function toBase64Url(bytes: Uint8Array): string {
  const parts: string[] = [];
  const CHUNK = 3 * 4096;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    let chunk = '';
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      chunk +=
        ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
    }
    if (end - i === 1) {
      const n = bytes[i] << 16;
      chunk += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
    } else if (end - i === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      chunk += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63];
    }
    parts.push(chunk);
  }
  return parts.join('');
}

export function fromBase64Url(text: string): Uint8Array {
  // Tolerate standard base64 and padding in case a link was re-encoded somewhere.
  const clean = text.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (clean.length % 4 === 1) throw new Error('Invalid base64 length');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code] : -1;
    if (value < 0) throw new Error('Invalid base64 character');
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
