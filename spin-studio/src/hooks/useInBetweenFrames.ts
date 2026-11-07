import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { interpolatePair, SkippedError } from '../lib/interpolate/client';
import { framesPerPhoto, inBetweenTimes } from '../lib/interpolate/plan';

export interface Photo {
  /** Changes whenever the image changes (e.g. when a cut-out replaces the original). */
  key: string;
  blob: Blob;
  url: string;
  thumbUrl: string;
}

export interface SequenceItem {
  blob: Blob;
  url: string;
  thumbUrl: string;
  generated: boolean;
  /** The photo this frame is, or follows when generated. */
  photoIndex: number;
}

export type FillStatus =
  /** Switched off, or the photo count doesn't call for in-between frames. */
  | { kind: 'off' }
  /** Waiting for the import or background removal to finish. */
  | { kind: 'waiting' }
  | { kind: 'working'; progress: number }
  | { kind: 'ready'; added: number }
  | { kind: 'failed'; message: string };

interface CachedPair {
  blobs: Blob[];
  urls: string[];
  thumbUrls: string[];
}

/**
 * Turns the photos into the spin's frame sequence. With too few photos for a
 * smooth turn, in-between frames are generated for every neighbouring pair
 * (including last → first, closing the loop). Pairs are cached by content, so
 * reordering or adding photos only regenerates the pairs that changed. Until
 * every pair is ready the sequence is just the photos, so the spin never mixes
 * smooth and jumpy stretches.
 *
 * `paused` holds new work back (while photos are still changing) without
 * dropping what is already cached.
 */
export function useInBetweenFrames(photos: Photo[], enabled: boolean, paused: boolean) {
  const cache = useRef(new Map<string, CachedPair>());
  // Shared between effect runs, so a pair still being generated isn't requested twice.
  const inflight = useRef(new Map<string, Promise<CachedPair>>());
  const pairProgress = useRef(new Map<string, number>());
  // Pairs the latest run wants; queued jobs for anything else are skipped.
  const wanted = useRef(new Set<string>());
  const alive = useRef(true);
  const [, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const perPhoto = enabled ? framesPerPhoto(photos.length) : 1;
  const pairKeys = useMemo(
    () =>
      perPhoto > 1
        ? photos.map((p, i) => `${p.key}>${photos[(i + 1) % photos.length].key}|${perPhoto}`)
        : [],
    [photos, perPhoto],
  );
  const pairsKey = pairKeys.join('\n');
  const active = pairKeys.length > 0 && !paused;

  useEffect(() => {
    if (!active) return;
    const needed = new Set(pairKeys);
    for (const [key, pair] of cache.current) {
      if (!needed.has(key)) {
        revokePair(pair);
        cache.current.delete(key);
      }
    }
    wanted.current = needed;
    setError(null);
    const missing = pairKeys.map((key, i) => ({ key, i })).filter(({ key }) => !cache.current.has(key));
    if (missing.length === 0) return;

    let cancelled = false;
    const rerender = () => setVersion((v) => v + 1);
    const jobs = missing.map(({ key, i }) => {
      let job = inflight.current.get(key);
      if (!job) {
        const a = photos[i];
        const b = photos[(i + 1) % photos.length];
        pairProgress.current.set(key, 0);
        job = interpolatePair(a.blob, b.blob, inBetweenTimes(perPhoto), {
          onProgress: (fraction) => {
            pairProgress.current.set(key, fraction);
            rerender();
          },
          shouldRun: () => wanted.current.has(key),
        })
          .then(({ frames, thumbs }) => {
            const pair: CachedPair = {
              blobs: frames,
              urls: frames.map((blob) => URL.createObjectURL(blob)),
              thumbUrls: thumbs.map((blob) => URL.createObjectURL(blob)),
            };
            if (alive.current) cache.current.set(key, pair);
            else revokePair(pair);
            return pair;
          })
          .finally(() => {
            inflight.current.delete(key);
            pairProgress.current.delete(key);
          });
        inflight.current.set(key, job);
      }
      return job;
    });
    Promise.all(jobs).then(
      () => {
        if (!cancelled) rerender();
      },
      (reason: unknown) => {
        if (cancelled || reason instanceof SkippedError) return;
        console.error('Could not create in-between frames', reason);
        // Stop the pairs still queued; finished ones stay cached for a retry.
        wanted.current = new Set();
        setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      cancelled = true;
      wanted.current = new Set();
    };
    // pairsKey captures everything pairKeys/photos/perPhoto contribute.
  }, [active, pairsKey, attempt]);

  useEffect(() => {
    alive.current = true;
    const pairs = cache.current;
    return () => {
      alive.current = false;
      for (const pair of pairs.values()) revokePair(pair);
      pairs.clear();
    };
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const ready = pairKeys.length > 0 && pairKeys.every((key) => cache.current.has(key));
  const sequence: SequenceItem[] = [];
  photos.forEach((photo, i) => {
    sequence.push({ blob: photo.blob, url: photo.url, thumbUrl: photo.thumbUrl, generated: false, photoIndex: i });
    const pair = ready ? cache.current.get(pairKeys[i]) : undefined;
    pair?.blobs.forEach((blob, k) =>
      sequence.push({ blob, url: pair.urls[k], thumbUrl: pair.thumbUrls[k], generated: true, photoIndex: i }),
    );
  });

  let status: FillStatus;
  if (pairKeys.length === 0) status = { kind: 'off' };
  else if (ready) status = { kind: 'ready', added: sequence.length - photos.length };
  else if (error) status = { kind: 'failed', message: error };
  else if (paused) status = { kind: 'waiting' };
  else {
    let done = 0;
    for (const key of pairKeys) done += cache.current.has(key) ? 1 : (pairProgress.current.get(key) ?? 0);
    status = { kind: 'working', progress: done / pairKeys.length };
  }

  return {
    sequence,
    /** Frames per photo in the current sequence (1 when nothing was generated). */
    perPhoto: ready ? perPhoto : 1,
    status,
    retry,
  };
}

function revokePair(pair: CachedPair) {
  pair.urls.forEach((url) => URL.revokeObjectURL(url));
  pair.thumbUrls.forEach((url) => URL.revokeObjectURL(url));
}
