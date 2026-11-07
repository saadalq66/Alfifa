import { useEffect, useMemo, useRef, useState } from 'react';
import { interpolatePair } from '../lib/interpolate/client';
import { framesPerPhoto, inBetweenTimes } from '../lib/interpolate/plan';

export interface Photo {
  /** Changes whenever the image changes (e.g. when a cut-out replaces the original). */
  key: string;
  blob: Blob;
  url: string;
}

export interface SequenceItem {
  blob: Blob;
  url: string;
  generated: boolean;
  /** The photo this frame is, or follows when generated. */
  photoIndex: number;
}

interface CachedPair {
  blobs: Blob[];
  urls: string[];
}

/**
 * Turns the photos into the spin's frame sequence. With too few photos for a
 * smooth turn, in-between frames are generated for every neighbouring pair
 * (including last → first, closing the loop). Pairs are cached by content, so
 * reordering or adding photos only regenerates the pairs that changed. Until
 * every pair is ready the sequence is just the photos, so the spin never mixes
 * smooth and jumpy stretches.
 */
export function useInBetweenFrames(photos: Photo[], enabled: boolean) {
  const cache = useRef(new Map<string, CachedPair>());
  // Shared between effect runs, so a pair still being generated isn't requested twice.
  const inflight = useRef(new Map<string, Promise<CachedPair>>());
  const [, setVersion] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const perPhoto = enabled ? framesPerPhoto(photos.length) : 1;
  const pairKeys = useMemo(
    () =>
      perPhoto > 1
        ? photos.map((p, i) => `${p.key}>${photos[(i + 1) % photos.length].key}|${perPhoto}`)
        : [],
    [photos, perPhoto],
  );
  const pairsKey = pairKeys.join('\n');

  useEffect(() => {
    if (!enabled) return;
    const needed = new Set(pairKeys);
    for (const [key, pair] of cache.current) {
      if (!needed.has(key)) {
        pair.urls.forEach((url) => URL.revokeObjectURL(url));
        cache.current.delete(key);
      }
    }
    const missing = pairKeys.map((key, i) => ({ key, i })).filter(({ key }) => !cache.current.has(key));
    setFailed(false);
    if (missing.length === 0) {
      setProgress(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setProgress({ done: 0, total: missing.length });
      for (const [n, { key, i }] of missing.entries()) {
        const a = photos[i];
        const b = photos[(i + 1) % photos.length];
        try {
          let job = inflight.current.get(key);
          if (!job) {
            job = interpolatePair(a.blob, b.blob, inBetweenTimes(perPhoto))
              .then((blobs) => {
                const pair = { blobs, urls: blobs.map((blob) => URL.createObjectURL(blob)) };
                cache.current.set(key, pair);
                return pair;
              })
              .finally(() => inflight.current.delete(key));
            inflight.current.set(key, job);
          }
          await job;
        } catch (error) {
          console.error('Could not create in-between frames', error);
          if (!cancelled) {
            setFailed(true);
            setProgress(null);
          }
          return;
        }
        if (cancelled) return;
        setProgress({ done: n + 1, total: missing.length });
      }
      if (!cancelled) {
        setProgress(null);
        setVersion((v) => v + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
    // pairsKey captures everything pairKeys/photos/perPhoto contribute.
  }, [enabled, pairsKey]);

  useEffect(
    () => () => {
      for (const pair of cache.current.values()) pair.urls.forEach((url) => URL.revokeObjectURL(url));
      cache.current.clear();
    },
    [],
  );

  const ready = perPhoto > 1 && pairKeys.every((key) => cache.current.has(key));
  const sequence: SequenceItem[] = [];
  photos.forEach((photo, i) => {
    sequence.push({ blob: photo.blob, url: photo.url, generated: false, photoIndex: i });
    const pair = ready ? cache.current.get(pairKeys[i]) : undefined;
    pair?.blobs.forEach((blob, k) => sequence.push({ blob, url: pair.urls[k], generated: true, photoIndex: i }));
  });

  return {
    sequence,
    /** Frames per photo in the current sequence (1 when nothing was generated). */
    perPhoto: ready ? perPhoto : 1,
    generating: enabled && perPhoto > 1 && !ready && !failed ? (progress ?? { done: 0, total: pairKeys.length }) : null,
    failed,
  };
}
