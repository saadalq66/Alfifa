import { useCallback, useEffect, useRef, useState } from 'react';
import { backgroundRemover, BackgroundRemovalError, type Stage } from '../lib/bgRemoval/client';
import { createCutout } from '../lib/frames';
import type { FrameStore } from './useFrames';

export type ModelState =
  | { phase: 'idle' }
  | { phase: 'downloading'; loaded: number; total: number }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

const STAGES: Record<Stage, { progress: number; label: string }> = {
  decode: { progress: 0.15, label: 'Reading image' },
  inference: { progress: 0.35, label: 'Finding the subject' },
  mask: { progress: 0.8, label: 'Cutting out' },
  encode: { progress: 0.92, label: 'Saving' },
};

/**
 * While enabled, works through every frame without a cutout, one at a time and
 * in sequence order. Results are cached on the frame, so turning the toggle
 * off and on again is instant.
 */
export function useBackgroundRemoval(enabled: boolean, store: FrameStore) {
  const { frames, updateBg, setCutout } = store;
  const [model, setModel] = useState<ModelState>({ phase: 'idle' });
  const [activeId, setActiveId] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    backgroundRemover.onDownload = ({ loaded, total }) =>
      setModel((current) => {
        if (current.phase === 'ready') return current;
        // Totals grow as each file starts downloading; never let the bar move backwards.
        const previous = current.phase === 'downloading' ? current : { loaded: 0, total: 0 };
        return {
          phase: 'downloading',
          loaded: Math.max(previous.loaded, loaded),
          total: Math.max(previous.total, total),
        };
      });
    return () => {
      backgroundRemover.onDownload = undefined;
    };
  }, []);

  useEffect(() => {
    if (!enabled || busy.current || model.phase === 'error') return;
    const next = frames.find((f) => !f.cutout && f.bg.status !== 'error');
    if (!next) return;

    busy.current = true;
    setActiveId(next.id);
    updateBg(next.id, {
      status: 'processing',
      progress: 0.05,
      stage: model.phase === 'ready' ? 'Starting' : 'Loading AI model',
      error: undefined,
    });

    backgroundRemover
      .process(next.id, next.blob, (stage) => {
        setModel((current) => (current.phase === 'ready' ? current : { phase: 'ready' }));
        updateBg(next.id, { progress: STAGES[stage].progress, stage: STAGES[stage].label });
      })
      .then(async (image) => setCutout(next.id, await createCutout(image)))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof BackgroundRemovalError && error.phase === 'init') {
          console.error('Background removal model failed to load:', error);
          setModel({ phase: 'error', message });
          updateBg(next.id, { status: 'idle', progress: 0, stage: undefined });
        } else {
          console.error(`Background removal failed for ${next.name}:`, error);
          updateBg(next.id, { status: 'error', progress: 0, stage: undefined, error: message });
        }
      })
      .finally(() => {
        busy.current = false;
        setActiveId(null);
      });
  }, [enabled, frames, model.phase, activeId, updateBg, setCutout]);

  const retryModel = useCallback(() => setModel({ phase: 'idle' }), []);

  const retryFrame = useCallback(
    (id: string) => updateBg(id, { status: 'idle', progress: 0, error: undefined }),
    [updateBg],
  );

  const remaining = frames.filter((f) => !f.cutout).length;
  const failed = frames.filter((f) => f.bg.status === 'error').length;

  return {
    model,
    activeId,
    /** True while there is (or will be) work in the queue. */
    processing: enabled && model.phase !== 'error' && remaining - failed > 0,
    done: frames.length - remaining,
    failed,
    retryModel,
    retryFrame,
  };
}
