import { useCallback, useEffect, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { MAX_FRAMES } from '../config';
import { importPhoto, isAcceptedImage, naturalCompare, revokeCutout, revokeFrame } from '../lib/frames';
import type { Cutout, Frame } from '../types';

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportResult {
  added: number;
  skipped: string[];
  truncated: boolean;
}

export interface FrameSource {
  blob: Blob;
  name: string;
}

/**
 * Owns the ordered frame list and the object URLs that belong to it. URL
 * clean-up happens here, outside state updaters, so it runs exactly once.
 */
export function useFrames() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const framesRef = useRef(frames);
  framesRef.current = frames;
  // Bumped by clear() so an import that is still running drops its results.
  const generation = useRef(0);

  useEffect(() => () => framesRef.current.forEach(revokeFrame), []);

  const importSources = useCallback(async (sources: FrameSource[]): Promise<ImportResult> => {
    const gen = generation.current;
    const room = Math.max(0, MAX_FRAMES - framesRef.current.length);
    const batch = sources.slice(0, room);
    const skipped: string[] = [];
    let added = 0;
    setImporting({ done: 0, total: batch.length });
    for (let i = 0; i < batch.length; i++) {
      const { blob, name } = batch[i];
      try {
        const frame = await importPhoto(blob, name);
        if (gen !== generation.current) {
          revokeFrame(frame);
          break;
        }
        added++;
        setFrames((prev) => [...prev, frame]);
      } catch {
        skipped.push(name);
      }
      if (gen === generation.current) setImporting({ done: i + 1, total: batch.length });
    }
    if (gen === generation.current) setImporting(null);
    return { added, skipped, truncated: sources.length > batch.length };
  }, []);

  /** Adds photos, sorted naturally by file name so camera sequences start in order. */
  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(isAcceptedImage).sort((a, b) => naturalCompare(a.name, b.name));
      const rejected = files.filter((file) => !isAcceptedImage(file)).map((file) => file.name);
      return importSources(accepted.map((file) => ({ blob: file, name: file.name }))).then(
        (result) => ({ ...result, skipped: [...rejected, ...result.skipped] }),
      );
    },
    [importSources],
  );

  const remove = useCallback((id: string) => {
    const frame = framesRef.current.find((f) => f.id === id);
    if (frame) revokeFrame(frame);
    setFrames((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => {
    generation.current++;
    framesRef.current.forEach(revokeFrame);
    setFrames([]);
    setImporting(null);
  }, []);

  const move = useCallback((activeId: string, overId: string) => {
    setFrames((prev) => {
      const from = prev.findIndex((f) => f.id === activeId);
      const to = prev.findIndex((f) => f.id === overId);
      return from < 0 || to < 0 || from === to ? prev : arrayMove(prev, from, to);
    });
  }, []);

  const reverse = useCallback(() => setFrames((prev) => [...prev].reverse()), []);

  const sortByName = useCallback(
    () => setFrames((prev) => [...prev].sort((a, b) => naturalCompare(a.name, b.name))),
    [],
  );

  const updateBg = useCallback((id: string, patch: Partial<Frame['bg']>) => {
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, bg: { ...f.bg, ...patch } } : f)));
  }, []);

  const setCutout = useCallback((id: string, cutout: Cutout) => {
    const frame = framesRef.current.find((f) => f.id === id);
    if (!frame) {
      revokeCutout(cutout);
      return;
    }
    revokeCutout(frame.cutout);
    setFrames((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, cutout, bg: { status: 'done', progress: 1, stage: undefined } } : f,
      ),
    );
  }, []);

  return {
    frames,
    importing,
    addFiles,
    importSources,
    remove,
    clear,
    move,
    reverse,
    sortByName,
    updateBg,
    setCutout,
  };
}

export type FrameStore = ReturnType<typeof useFrames>;
