import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Hand, Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';
import { SpinEngine, type SpinState } from '../lib/spinEngine';
import type { BackdropId } from '../types';
import { backdropCss, backdropOuterColor } from '../lib/backdrops';
import { cx } from './ui';

export interface SpinViewerHandle {
  goTo(index: number): void;
}

type Variant = 'studio' | 'hero' | 'preview' | 'embed';

interface SpinViewerProps {
  frames: readonly string[];
  fps: number;
  invertDrag?: boolean;
  autoplay?: boolean;
  backdrop: BackdropId;
  variant: Variant;
  /** Width / height of the frames, used to size the stage. */
  aspect?: number;
  onIndexChange?: (index: number) => void;
  ref?: Ref<SpinViewerHandle>;
  className?: string;
}

const INITIAL: SpinState = {
  index: 0,
  count: 0,
  playing: false,
  loaded: 0,
  interacted: false,
  dragging: false,
};

export function SpinViewer({
  frames,
  fps,
  invertDrag = false,
  autoplay = false,
  backdrop,
  variant,
  aspect = 4 / 3,
  onIndexChange,
  ref,
  className,
}: SpinViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SpinEngine | null>(null);
  const [state, setState] = useState<SpinState>(INITIAL);
  const [fullscreen, setFullscreen] = useState(false);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const autoplayRef = useRef(autoplay);

  // The engine lives as long as the component; option and frame changes are synced below.
  useEffect(() => {
    let lastIndex = -1;
    const engine = new SpinEngine(surfaceRef.current!, canvasRef.current!, {
      fps,
      invertDrag,
      onChange: (next) => {
        setState(next);
        if (next.index !== lastIndex) {
          lastIndex = next.index;
          onIndexChangeRef.current?.(next.index);
        }
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOptions({ fps, invertDrag });
  }, [fps, invertDrag]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setFrames(frames);
    if (autoplayRef.current && frames.length > 1) {
      autoplayRef.current = false;
      engine.play();
    }
  }, [frames]);

  useImperativeHandle(ref, () => ({ goTo: (index) => engineRef.current?.goTo(index) }), []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const toggle = () => engineRef.current?.toggle();
  const reset = () => engineRef.current?.reset();
  const loading = state.count > 0 && state.loaded < state.count;
  const firstFramePending = state.count > 0 && state.loaded === 0;
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;
  const showHint = !state.interacted && state.count > 1 && !firstFramePending;
  const isEmbed = variant === 'embed';

  // The backdrop gradient sits exactly behind the (contain-fitted) frame, and its
  // edge colour fills any letterbox space. Share links bake this same gradient
  // into their frames, so baked and live backdrops line up seamlessly.
  const checker = backdrop === 'transparent' && !isEmbed;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;

  const stage = (
    <div
      ref={rootRef}
      className={cx(
        'spin-stage group/stage relative isolate overflow-hidden select-none',
        checker && 'bg-checker',
        isEmbed ? 'h-full w-full' : 'w-full rounded-[1.75rem] ring-1 ring-slate-900/5',
        variant === 'studio' && 'max-h-[72vh] shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_60px_-28px_rgba(15,23,42,0.35)]',
        variant === 'hero' && 'shadow-2xl shadow-sky-900/10',
      )}
      style={{
        containerType: 'size',
        background: checker ? undefined : backdropOuterColor(backdrop),
        aspectRatio: isEmbed ? undefined : String(clampAspect(aspect)),
      }}
    >
      {!checker && backdrop !== 'transparent' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto"
          style={{
            width: `min(100cqw, calc(100cqh * ${ratio}))`,
            height: `min(100cqh, calc(100cqw / ${ratio}))`,
            background: backdropCss(backdrop),
          }}
        />
      )}

      <div
        ref={surfaceRef}
        role="slider"
        tabIndex={0}
        aria-label="360° view. Drag, swipe or use the arrow keys to rotate."
        aria-valuemin={1}
        aria-valuemax={Math.max(1, state.count)}
        aria-valuenow={state.index + 1}
        aria-valuetext={`Frame ${state.index + 1} of ${state.count}`}
        className={cx(
          'absolute inset-0 outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 focus-visible:ring-inset',
          isEmbed ? 'touch-none' : 'touch-pan-y',
          state.count > 1 && (state.dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <canvas ref={canvasRef} className="pointer-events-none block h-full w-full" />
      </div>

      {firstFramePending && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-300/60 border-t-sky-500" />
        </div>
      )}

      {loading && !firstFramePending && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-slate-900/5">
          <div
            className="h-full bg-sky-500 transition-[width] duration-300"
            style={{ width: `${(state.loaded / state.count) * 100}%` }}
          />
        </div>
      )}

      {showHint && (
        <div
          className={cx(
            'pointer-events-none absolute inset-x-0 flex justify-center transition-opacity duration-500',
            isEmbed ? 'bottom-20' : 'bottom-4',
          )}
        >
          <div className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md">
            <Hand className="h-3.5 w-3.5 motion-safe:animate-[nudge_1.8s_ease-in-out_infinite]" aria-hidden />
            Drag to rotate
          </div>
        </div>
      )}

      {(variant === 'studio' || variant === 'preview') && state.count > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
          {state.index + 1} / {state.count}
        </div>
      )}

      {variant === 'studio' && canFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur transition hover:scale-105 hover:text-slate-900 active:scale-95"
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          title={fullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      )}

      {isEmbed && state.count > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-white/85 p-1 shadow-lg ring-1 ring-slate-900/5 backdrop-blur-md transition-opacity duration-300 sm:opacity-80 sm:hover:opacity-100">
            <IconButton
              label={state.playing ? 'Pause auto-rotate' : 'Play auto-rotate'}
              onClick={toggle}
            >
              {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconButton>
            <IconButton label="Reset view" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
            {canFullscreen && (
              <IconButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </IconButton>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (variant !== 'studio') {
    return <div className={cx(isEmbed && 'h-full w-full', className)}>{stage}</div>;
  }

  return (
    <div className={className}>
      {stage}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={state.count < 2}
          aria-pressed={state.playing}
          className={cx(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-95 disabled:pointer-events-none disabled:opacity-40',
            state.playing
              ? 'bg-sky-600 text-white shadow-sky-600/25 hover:bg-sky-500'
              : 'bg-slate-900 text-white hover:bg-slate-800',
          )}
        >
          {state.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {state.playing ? 'Pause Auto-Rotate' : 'Play Auto-Rotate'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={state.count < 2}
          className="group/reset inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover/reset:-rotate-[200deg]" />
          Reset View
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-full text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900 active:scale-90"
    >
      {children}
    </button>
  );
}

function clampAspect(aspect: number) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 4 / 3;
  return Math.min(2, Math.max(0.75, aspect));
}
