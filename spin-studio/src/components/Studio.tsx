import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowLeftRight,
  Download,
  Gauge,
  ImagePlus,
  Palette,
  RefreshCw,
  Share2,
  Trash,
  TriangleAlert,
  Wand,
} from 'lucide-react';
import { useBackgroundRemoval, type ModelState } from '../hooks/useBackgroundRemoval';
import type { FrameStore } from '../hooks/useFrames';
import { BACKDROPS, backdropCss } from '../lib/backdrops';
import { downloadBlob, exportFilename, exportProjectZip } from '../lib/exportZip';
import { displayBlob, displayUrl } from '../lib/frames';
import { formatBytes } from '../lib/share';
import { defaultFps } from '../lib/spinMath';
import type { BackdropId, ViewerSettings } from '../types';
import { Dropzone, useFileDrop } from './Dropzone';
import { FrameGrid } from './FrameGrid';
import { ShareModal } from './ShareModal';
import { SpinViewer, type SpinViewerHandle } from './SpinViewer';
import { useToast } from './Toast';
import { Button, cx, Spinner, Switch } from './ui';

interface StudioProps {
  store: FrameStore;
  onBrowse: () => void;
  onFiles: (files: File[]) => void;
  onSample: () => void;
}

export function Studio({ store, onBrowse, onFiles, onSample }: StudioProps) {
  const { frames, importing } = store;
  const toast = useToast();
  const viewer = useRef<SpinViewerHandle>(null);
  const [removeBackgrounds, setRemoveBackgrounds] = useState(false);
  const [customFps, setCustomFps] = useState<number | null>(null);
  const [invertDrag, setInvertDrag] = useState(false);
  const [backdrop, setBackdrop] = useState<BackdropId>('studio');
  const [current, setCurrent] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bg = useBackgroundRemoval(removeBackgrounds, store);
  const { dragging, handlers } = useFileDrop(onFiles);
  // Stable, so memoised tiles don't all re-render on every frame of a spin.
  const jumpTo = useCallback((index: number) => viewer.current?.goTo(index), []);

  const settings: ViewerSettings = {
    fps: customFps ?? defaultFps(frames.length),
    invertDrag,
    backdrop,
  };

  const urlKey = frames.map((f) => displayUrl(f, removeBackgrounds)).join('\n');
  const urls = useMemo(() => (urlKey ? urlKey.split('\n') : []), [urlKey]);
  const shareSources = useMemo(
    () => (shareOpen ? frames.map((f) => displayBlob(f, removeBackgrounds)) : []),
    // Deliberately snapshots the frames at the moment the dialog opens.
    [shareOpen],
  );

  const busyReason = importing
    ? 'Wait for the import to finish'
    : bg.processing
      ? 'Wait for background removal to finish'
      : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const zip = await exportProjectZip(frames, settings, removeBackgrounds);
      downloadBlob(zip, exportFilename());
      toast(`Exported ${frames.length} frames (${formatBytes(zip.size)})`);
    } catch (error) {
      console.error(error);
      toast('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    if (window.confirm(`Remove all ${frames.length} frames from this project?`)) {
      store.clear();
      setRemoveBackgrounds(false);
      setCustomFps(null);
    }
  };

  if (frames.length === 0) {
    return (
      <Dropzone
        onBrowse={onBrowse}
        onFiles={onFiles}
        onSample={onSample}
        busy={importing !== null}
      />
    );
  }

  const first = frames[0];

  return (
    <div {...handlers} className="relative">
      {dragging && (
        <div className="pointer-events-none absolute -inset-3 z-30 grid place-items-center rounded-[2rem] border-2 border-dashed border-sky-400 bg-sky-50/80 backdrop-blur-sm">
          <p className="flex items-center gap-2 text-lg font-semibold text-sky-700">
            <ImagePlus className="h-6 w-6" /> Drop to add photos
          </p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-900">{frames.length} frames</span>
          {' · '}
          {first.width}×{first.height}
        </p>
        <div className="flex flex-wrap gap-2" title={busyReason ?? undefined}>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={!!busyReason || exporting}
            icon={exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          >
            Export Project
          </Button>
          <Button
            variant="accent"
            onClick={() => setShareOpen(true)}
            disabled={!!busyReason}
            icon={<Share2 className="h-4 w-4" />}
          >
            Share Project
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <SpinViewer
          ref={viewer}
          variant="studio"
          frames={urls}
          fps={settings.fps}
          invertDrag={invertDrag}
          backdrop={backdrop}
          aspect={first.width / first.height}
          onIndexChange={setCurrent}
        />

        <aside className="space-y-4">
          <Panel>
            <Switch
              id="remove-backgrounds"
              checked={removeBackgrounds}
              onChange={setRemoveBackgrounds}
              label={
                <span className="flex items-center gap-2">
                  <Wand className="h-4 w-4 text-sky-600" /> Remove Backgrounds
                </span>
              }
              description="AI cut-outs for every frame, computed on your device. The first run downloads a ~100 MB model."
            />
            {removeBackgrounds && (
              <BackgroundStatus
                model={bg.model}
                done={bg.done}
                total={frames.length}
                failed={bg.failed}
                processing={bg.processing}
                onRetry={bg.retryModel}
              />
            )}
          </Panel>

          <Panel>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="speed" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Gauge className="h-4 w-4 text-slate-400" /> Auto-rotate speed
                </label>
                <span className="text-xs tabular-nums text-slate-500">
                  {(frames.length / settings.fps).toFixed(1)} s / turn
                </span>
              </div>
              <input
                id="speed"
                type="range"
                min={2}
                max={36}
                value={settings.fps}
                onChange={(e) => setCustomFps(Number(e.currentTarget.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <Switch
              id="invert-drag"
              checked={invertDrag}
              onChange={setInvertDrag}
              label={
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-slate-400" /> Invert drag direction
                </span>
              }
              description="Turn on if dragging spins the object the “wrong” way."
            />

            <fieldset>
              <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Palette className="h-4 w-4 text-slate-400" /> Backdrop
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {BACKDROPS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBackdrop(option.id)}
                    aria-pressed={backdrop === option.id}
                    aria-label={option.label}
                    title={option.label}
                    className={cx(
                      'h-9 w-9 rounded-full ring-1 ring-slate-900/10 transition hover:scale-110 active:scale-95',
                      option.id === 'transparent' && 'bg-checker',
                      backdrop === option.id && 'ring-2 ring-sky-500 ring-offset-2',
                    )}
                    style={option.id === 'transparent' ? undefined : { background: backdropCss(option.id) }}
                  />
                ))}
              </div>
              {removeBackgrounds ? null : (
                <p className="mt-2 text-xs text-slate-500">Most visible once backgrounds are removed.</p>
              )}
            </fieldset>
          </Panel>
        </aside>
      </div>

      <section className="mt-8 rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Sequence</h3>
            <p className="text-xs text-slate-500">
              {importing ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-sky-700">
                  <Spinner className="h-3 w-3" /> Importing {importing.done} / {importing.total}…
                </span>
              ) : (
                <>
                  Drag to reorder{' '}
                  <span className="hidden sm:inline">· click a frame to jump to it</span>
                  <span className="sm:hidden">· long-press to drag</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={store.sortByName} icon={<ArrowDownAZ className="h-3.5 w-3.5" />}>
              Sort by name
            </Button>
            <Button size="sm" variant="ghost" onClick={store.reverse} icon={<ArrowDownUp className="h-3.5 w-3.5" />}>
              Reverse
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              icon={<Trash className="h-3.5 w-3.5" />}
              className="hover:bg-red-50 hover:text-red-600"
            >
              Clear all
            </Button>
          </div>
        </div>
        <FrameGrid
          frames={frames}
          currentIndex={current}
          removeBackgrounds={removeBackgrounds}
          onMove={store.move}
          onRemove={store.remove}
          onSelect={jumpTo}
          onRetry={bg.retryFrame}
          onAdd={onBrowse}
        />
      </section>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        sources={shareSources}
        settings={settings}
        hasCutouts={removeBackgrounds && frames.some((f) => f.cutout)}
      />
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-5 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-900/5">{children}</div>;
}

function BackgroundStatus({
  model,
  done,
  total,
  failed,
  processing,
  onRetry,
}: {
  model: ModelState;
  done: number;
  total: number;
  failed: number;
  processing: boolean;
  onRetry: () => void;
}) {
  if (model.phase === 'error') {
    return (
      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
        <p className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert className="h-3.5 w-3.5" /> Couldn’t load the AI model
        </p>
        <p className="mt-1 leading-relaxed text-red-600/90">
          Check your connection (the model is downloaded once, then cached) and try again.
        </p>
        <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Retry
        </Button>
      </div>
    );
  }

  const downloading = model.phase === 'downloading' && model.total > 0;
  const ratio = downloading ? model.loaded / model.total : total ? done / total : 0;

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          {processing && <Spinner className="h-3 w-3 text-sky-600" />}
          {downloading
            ? 'Downloading AI model (one-time)'
            : processing
              ? 'Removing backgrounds'
              : failed
                ? `${failed} frame${failed === 1 ? '' : 's'} failed`
                : 'All backgrounds removed'}
        </span>
        <span className="tabular-nums text-slate-500">
          {downloading ? `${formatBytes(model.loaded)} / ${formatBytes(model.total)}` : `${done} / ${total}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            processing
              ? 'animate-shimmer bg-[linear-gradient(90deg,#0ea5e9,#60a5fa,#0ea5e9)]'
              : failed
                ? 'bg-amber-500'
                : 'bg-emerald-500',
          )}
          style={{ width: `${Math.max(3, ratio * 100)}%` }}
        />
      </div>
      {failed > 0 && !processing && (
        <p className="text-xs text-slate-500">Use “Retry” on the highlighted frames below.</p>
      )}
    </div>
  );
}
