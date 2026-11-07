import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowLeftRight,
  Download,
  Film,
  Sparkles,
  Gauge,
  ImagePlus,
  RefreshCw,
  Share2,
  Trash,
  TriangleAlert,
  Wand,
} from 'lucide-react';
import { useBackgroundRemoval, type ModelState } from '../hooks/useBackgroundRemoval';
import { useInBetweenFrames, type Photo } from '../hooks/useInBetweenFrames';
import { MIN_PHOTOS, TARGET_FRAMES } from '../lib/interpolate/plan';
import type { FrameStore } from '../hooks/useFrames';
import { downloadBlob, exportFilename, exportProjectZip } from '../lib/exportZip';
import { displayBlob, displayUrl } from '../lib/frames';
import { formatBytes } from '../lib/share';
import { defaultFps } from '../lib/spinMath';
import { useLoadedScene } from '../hooks/useScene';
import { DEFAULT_SCENE, type Scene } from '../lib/scene';
import type { ViewerSettings } from '../types';
import { Dropzone, useFileDrop } from './Dropzone';
import { FrameGrid } from './FrameGrid';
import { ScenePanel } from './ScenePanel';
import { ShareModal } from './ShareModal';
import { SpinViewer, type SpinViewerHandle } from './SpinViewer';
import { useToast } from './Toast';
import { Button, cx, Spinner, Switch } from './ui';
import { VideoModal } from './VideoModal';

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
  const [scene, setScene] = useState<Scene>(DEFAULT_SCENE);
  const loadedScene = useLoadedScene(scene);
  const [current, setCurrent] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fillFrames, setFillFrames] = useState(true);
  const bg = useBackgroundRemoval(removeBackgrounds, store);
  const { dragging, handlers } = useFileDrop(onFiles);

  // The photos as currently shown (cut-outs when background removal is on).
  const photoKey = frames
    .map((f) => `${f.id}:${removeBackgrounds && f.cutout ? 'cut' : 'photo'}`)
    .join('\n');
  const photos = useMemo<Photo[]>(
    () =>
      frames.map((f) => ({
        key: `${f.id}:${removeBackgrounds && f.cutout ? 'cut' : 'photo'}`,
        blob: displayBlob(f, removeBackgrounds),
        url: displayUrl(f, removeBackgrounds),
      })),
    // photoKey changes exactly when any photo's displayed image changes.
    [photoKey],
  );
  // Generate in-between frames once imports and background removal have settled.
  const fill = useInBetweenFrames(photos, fillFrames && !importing && !bg.processing);
  const sequence = fill.sequence;
  const canFill = frames.length >= MIN_PHOTOS && frames.length < TARGET_FRAMES;

  // The viewer plays the whole sequence; the grid shows (and highlights) photos.
  const perPhoto = fill.perPhoto;
  const currentPhoto = sequence[current]?.photoIndex ?? 0;
  const jumpTo = useCallback((index: number) => viewer.current?.goTo(index * perPhoto), [perPhoto]);

  const settings: ViewerSettings = {
    fps: customFps ?? defaultFps(sequence.length),
    invertDrag,
  };

  const urlKey = sequence.map((item) => item.url).join('\n');
  const urls = useMemo(() => (urlKey ? urlKey.split('\n') : []), [urlKey]);
  const dialogOpen = shareOpen || videoOpen;
  const dialogSources = useMemo(
    () => (dialogOpen ? sequence.map((item) => item.blob) : []),
    // Deliberately snapshots the frames at the moment a dialog opens.
    [dialogOpen],
  );

  const busyReason = importing
    ? 'Wait for the import to finish'
    : bg.processing
      ? 'Wait for background removal to finish'
      : fill.generating
        ? 'Wait for the in-between frames to be created'
        : null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const items = sequence.map((item) => {
        const photo = frames[item.photoIndex];
        const next = frames[(item.photoIndex + 1) % frames.length];
        return {
          blob: item.blob,
          source: item.generated ? `generated between ${photo.name} and ${next.name}` : photo.name,
          width: photo.width,
          height: photo.height,
          generated: item.generated,
        };
      });
      const backgroundRemoved = removeBackgrounds && frames.every((f) => f.cutout);
      const zip = await exportProjectZip(items, settings, backgroundRemoved, loadedScene);
      downloadBlob(zip, exportFilename());
      toast(`Exported ${items.length} frames (${formatBytes(zip.size)})`);
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
          <span className="font-semibold text-slate-900">{sequence.length} frames</span>
          {perPhoto > 1 && ` (${frames.length} photos + ${sequence.length - frames.length} generated)`}
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
            variant="secondary"
            onClick={() => setVideoOpen(true)}
            disabled={!!busyReason}
            icon={<Film className="h-4 w-4" />}
          >
            Download Video
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
          scene={loadedScene}
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
                  {(sequence.length / settings.fps).toFixed(1)} s / turn
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
          </Panel>

          <Panel>
            <h3 className="text-sm font-semibold text-slate-900">Background &amp; branding</h3>
            <ScenePanel scene={scene} onChange={setScene} removeBackgrounds={removeBackgrounds} />
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
              ) : fill.generating ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-sky-700">
                  <Spinner className="h-3 w-3" /> Creating in-between frames… {fill.generating.done} /{' '}
                  {fill.generating.total}
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
        {canFill && (
          <div className="mb-4 rounded-2xl bg-sky-50/70 p-4 ring-1 ring-sky-100">
            <Switch
              id="fill-frames"
              checked={fillFrames}
              onChange={setFillFrames}
              label={
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-600" /> Fill in to {TARGET_FRAMES}+ frames
                </span>
              }
              description={
                fill.failed
                  ? 'Couldn’t create in-between frames for these photos — the spin uses your photos only.'
                  : perPhoto > 1
                    ? `${frames.length} photos + ${sequence.length - frames.length} in-between frames, created from the motion between neighbouring photos. More photos still look best.`
                    : `${frames.length} photos make a jumpy spin. In-between frames are created from the motion between neighbouring photos.`
              }
            />
          </div>
        )}
        <FrameGrid
          frames={frames}
          currentIndex={currentPhoto}
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
        sources={dialogSources}
        settings={settings}
        scene={loadedScene}
        hasCutouts={removeBackgrounds && frames.some((f) => f.cutout)}
      />
      <VideoModal
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        sources={dialogSources}
        settings={settings}
        scene={loadedScene}
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
