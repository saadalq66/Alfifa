import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Film, Lock, RefreshCw, Share, TriangleAlert } from 'lucide-react';
import { exportFilename } from '../lib/exportZip';
import { formatBytes } from '../lib/share';
import { canRenderVideo, renderSpinVideo, VideoUnsupportedError, type RenderedVideo } from '../lib/video';
import { planVideo, videoSize } from '../lib/videoPlan';
import type { LoadedScene } from '../lib/scene';
import type { ViewerSettings } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Button, Segmented } from './ui';

interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  sources: Blob[];
  settings: ViewerSettings;
  scene: LoadedScene;
}

export function VideoModal({ open, onClose, sources, settings, scene }: VideoModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Film className="h-5 w-5" />}
      title="Download Video"
      description="Turn the spin into a video you can post or send anywhere."
    >
      {open && <VideoBody sources={sources} settings={settings} scene={scene} />}
    </Modal>
  );
}

type Phase =
  | { kind: 'options' }
  | { kind: 'rendering'; progress: number }
  | { kind: 'done'; video: RenderedVideo; url: string; filename: string }
  | { kind: 'error'; message: string };

const TURNS = [1, 2, 3];
const SIZES = [
  { value: 720, label: '720p' },
  { value: 1080, label: '1080p' },
];

function VideoBody({
  sources,
  settings,
  scene,
}: {
  sources: Blob[];
  settings: ViewerSettings;
  scene: LoadedScene;
}) {
  const toast = useToast();
  const [turns, setTurns] = useState(2);
  const [shortEdge, setShortEdge] = useState(1080);
  const [phase, setPhase] = useState<Phase>({ kind: 'options' });
  const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const supported = canRenderVideo();

  // Closing the dialog cancels a render in progress.
  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (phase.kind !== 'done') return;
    return () => URL.revokeObjectURL(phase.url);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    if (!sources[0]) return;
    createImageBitmap(sources[0])
      .then((bitmap) => {
        if (!cancelled) setFrameSize({ width: bitmap.width, height: bitmap.height });
        bitmap.close();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sources]);

  const plan = planVideo(sources.length, settings.fps, turns);
  const size = frameSize && videoSize(frameSize.width, frameSize.height, shortEdge);

  const render = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'rendering', progress: 0 });
    try {
      const video = await renderSpinVideo(sources, {
        turns,
        shortEdge,
        spinFps: settings.fps,
        scene,
        signal: controller.signal,
        onProgress: (progress) => setPhase({ kind: 'rendering', progress }),
      });
      setPhase({
        kind: 'done',
        video,
        url: URL.createObjectURL(video.blob),
        filename: exportFilename(video.extension),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase({ kind: 'options' });
        return;
      }
      console.error(error);
      setPhase({
        kind: 'error',
        message:
          error instanceof VideoUnsupportedError
            ? `${error.message} Try a recent version of Chrome, Edge, Safari or Firefox.`
            : 'Something went wrong while creating the video. Try 720p or a shorter video.',
      });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  };

  if (!supported) {
    return (
      <Notice>
        This browser can’t create videos. Please open Spin Studio in a recent version of Chrome, Edge, Safari or
        Firefox.
      </Notice>
    );
  }

  if (phase.kind === 'done') {
    const { video, url, filename } = phase;
    const file = new File([video.blob], filename, { type: video.blob.type });
    const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    const share = async () => {
      try {
        await navigator.share({ files: [file], title: '360° spin' });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') toast('Sharing failed — use Download instead.', 'error');
      }
    };
    return (
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          controls
          className="w-full rounded-[1.5rem] bg-slate-100 ring-1 ring-slate-900/5"
          style={{ aspectRatio: `${video.width} / ${video.height}` }}
        />
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Your video is ready</p>
            <p className="mt-1 text-xs tabular-nums text-slate-500">
              {video.extension.toUpperCase()} · {video.width}×{video.height} · {video.duration.toFixed(1)} s ·{' '}
              {formatBytes(video.blob.size)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={url}
              download={filename}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 px-6 text-base font-semibold text-white shadow-md shadow-blue-600/25 transition hover:from-sky-400 active:scale-[0.97]"
            >
              <Download className="h-5 w-5" /> Download {video.extension.toUpperCase()}
            </a>
            {canShare && (
              <Button size="lg" variant="secondary" onClick={share} icon={<Share className="h-4.5 w-4.5" />}>
                Share or save to Photos
              </Button>
            )}
            <Button variant="ghost" onClick={() => setPhase({ kind: 'options' })} icon={<RefreshCw className="h-4 w-4" />}>
              Change settings
            </Button>
          </div>
          {video.extension !== 'mp4' && (
            <p className="text-xs leading-relaxed text-slate-500">
              This browser can’t encode MP4, so the video is WebM. For an MP4 that plays everywhere, use Chrome, Edge
              or Safari.
            </p>
          )}
        </div>
      </div>
    );
  }

  const rendering = phase.kind === 'rendering';

  return (
    <div className="space-y-5">
      <fieldset disabled={rendering}>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Length</legend>
        <Segmented
          value={turns}
          onChange={setTurns}
          options={TURNS.map((n) => ({
            value: n,
            label: `${n} turn${n === 1 ? '' : 's'}`,
            hint: `${(plan.turnDuration * n).toFixed(1)} s`,
          }))}
        />
      </fieldset>

      <fieldset disabled={rendering}>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Resolution</legend>
        <Segmented
          value={shortEdge}
          onChange={setShortEdge}
          options={SIZES.map((s) => {
            const dims = frameSize && videoSize(frameSize.width, frameSize.height, s.value);
            return { value: s.value, label: s.label, hint: dims ? `${dims.width}×${dims.height}` : '…' };
          })}
        />
      </fieldset>

      <ul className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        <li>
          {sources.length} frames, one full turn every {plan.turnDuration.toFixed(1)} s — change it with{' '}
          <span className="font-medium text-slate-700">Auto-rotate speed</span>.
        </li>
        <li>
          {scene.transparent
            ? 'Videos can’t be transparent, so a white background is used.'
            : 'Uses the background, text and logo you set in the studio.'}
        </li>
        <li className="flex gap-1.5">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" /> Rendered on your device — nothing is uploaded.
        </li>
      </ul>

      {phase.kind === 'error' && <Notice>{phase.message}</Notice>}

      {rendering ? (
        <div className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Creating video…</span>
            <span className="tabular-nums text-slate-500">{Math.round(phase.progress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#60a5fa,#0ea5e9)] animate-shimmer transition-[width] duration-200"
              style={{ width: `${Math.max(2, phase.progress * 100)}%` }}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={render}
          icon={<Film className="h-5 w-5" />}
        >
          Create video{size ? ` · ${size.width}×${size.height}` : ''}
        </Button>
      )}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-800">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
