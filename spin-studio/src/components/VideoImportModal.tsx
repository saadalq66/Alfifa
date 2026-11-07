import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Scissors, TriangleAlert, Video } from 'lucide-react';
import { MAX_FRAMES } from '../config';
import { extractVideoFrames, seek } from '../lib/videoFrames';
import { Modal } from './Modal';
import { Button, Segmented, Switch } from './ui';

interface VideoImportModalProps {
  file: File | null;
  /** Frames already in the project. */
  existingCount: number;
  onClose: () => void;
  onExtracted: (frames: Blob[], replace: boolean) => void;
}

export function VideoImportModal({ file, existingCount, onClose, onExtracted }: VideoImportModalProps) {
  return (
    <Modal
      open={file !== null}
      onClose={onClose}
      icon={<Video className="h-5 w-5" />}
      title="Create frames from a video"
      description="Mark one full turn of the object, then choose how many frames to take."
    >
      {file && (
        <ImportBody key={`${file.name}-${file.size}-${file.lastModified}`} file={file} existingCount={existingCount} onExtracted={onExtracted} />
      )}
    </Modal>
  );
}

const COUNTS = [24, 36, 48, 72];
/** Assumed for deciding which frame counts a short selection can supply; phones record 30 fps or more. */
const ASSUMED_FPS = 30;
const MIN_SPAN = 0.2;

function ImportBody({
  file,
  existingCount,
  onExtracted,
}: {
  file: File;
  existingCount: number;
  onExtracted: (frames: Blob[], replace: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string>();
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [count, setCount] = useState(36);
  const [replace, setReplace] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Closing the dialog stops a capture in progress.
  useEffect(() => () => abort.current?.abort(), []);

  const onLoaded = () => {
    const video = videoRef.current!;
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) {
      setError('This video has no readable length. Try exporting it again as MP4.');
      return;
    }
    setDuration(video.duration);
    setStart(0);
    setEnd(video.duration);
  };

  const span = Math.max(0, end - start);
  const appending = existingCount > 0 && !replace;
  const room = appending ? MAX_FRAMES - existingCount : MAX_FRAMES;
  const available = Math.max(1, Math.floor(span * ASSUMED_FPS));
  const usable = (n: number) => n <= available && n <= room;
  const options = COUNTS.map((n) => ({ value: n, label: String(n), hint: 'frames', disabled: !usable(n) }));
  const effectiveCount = usable(count) ? count : (COUNTS.filter(usable).pop() ?? Math.min(available, room));

  const preview = (time: number) => {
    const video = videoRef.current;
    if (video) void seek(video, time).catch(() => undefined);
  };

  const changeStart = (value: number) => {
    const next = Math.min(value, end - MIN_SPAN);
    setStart(Math.max(0, next));
    preview(Math.max(0, next));
  };

  const changeEnd = (value: number) => {
    const next = Math.max(value, start + MIN_SPAN);
    setEnd(Math.min(duration, next));
    preview(Math.min(duration, next));
  };

  const setFromCurrent = (which: 'start' | 'end') => {
    const time = videoRef.current?.currentTime ?? 0;
    if (which === 'start') changeStart(time);
    else changeEnd(time);
  };

  const extract = async () => {
    const video = videoRef.current;
    if (!video || effectiveCount < 1) return;
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setProgress(0);
    try {
      const frames = await extractVideoFrames(video, {
        start,
        end,
        count: effectiveCount,
        signal: controller.signal,
        onProgress: setProgress,
      });
      onExtracted(frames, existingCount > 0 && replace);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(err);
        setError('Could not read frames from this video. Try exporting it again as MP4.');
      }
      setProgress(null);
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  };

  const busy = progress !== null;
  const ready = duration > 0 && !error;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <video
          ref={videoRef}
          src={url}
          controls={!busy}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={onLoaded}
          onError={() =>
            setError(
              'This browser can’t play this video format. Try an MP4 (H.264) — on iPhone, Settings → Camera → Formats → Most Compatible.',
            )
          }
          className="aspect-video w-full rounded-[1.5rem] bg-slate-900 object-contain"
        />
        <p className="truncate text-center text-xs text-slate-500">{file.name}</p>
      </div>

      <div className="min-w-0 space-y-5">
        {error && <Notice>{error}</Notice>}

        <fieldset disabled={!ready || busy} className="space-y-4">
          <legend className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Scissors className="h-4 w-4 text-slate-400" /> One full turn
          </legend>
          <TrimSlider
            label="Start"
            value={start}
            max={duration}
            onChange={changeStart}
            onUseCurrent={() => setFromCurrent('start')}
          />
          <TrimSlider
            label="End"
            value={end}
            max={duration}
            onChange={changeEnd}
            onUseCurrent={() => setFromCurrent('end')}
          />
          <p className="text-xs leading-relaxed text-slate-500">
            {span.toFixed(1)} s selected. For a seamless loop, the end should show the object exactly as it looks at the
            start.
          </p>
        </fieldset>

        <fieldset disabled={!ready || busy}>
          <legend className="mb-2 text-sm font-semibold text-slate-900">Frames</legend>
          <Segmented
            value={effectiveCount}
            onChange={setCount}
            options={options}
          />
          <p className="mt-2 text-xs text-slate-500">More frames give a smoother spin; 36 suits most objects.</p>
        </fieldset>

        {existingCount > 0 && (
          <Switch
            id="video-replace"
            checked={replace}
            onChange={setReplace}
            disabled={busy}
            label="Replace current frames"
            description={`Turn off to add these frames after the ${existingCount} already in the project.`}
          />
        )}

        {busy ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Capturing frames…</span>
              <span className="tabular-nums text-slate-500">{Math.round((progress ?? 0) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-[width] duration-200"
                style={{ width: `${Math.max(2, (progress ?? 0) * 100)}%` }}
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
            disabled={!ready || room < 1}
            onClick={extract}
            icon={<Video className="h-5 w-5" />}
          >
            {error
              ? 'Choose another video'
              : !ready
                ? 'Loading video…'
                : room < 1
                  ? `Projects are limited to ${MAX_FRAMES} frames`
                  : `Use ${effectiveCount} frame${effectiveCount === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function TrimSlider({
  label,
  value,
  max,
  onChange,
  onUseCurrent,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  onUseCurrent: () => void;
}) {
  const id = `trim-${label.toLowerCase()}`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-600">
          {label} <span className="tabular-nums text-slate-400">{value.toFixed(2)} s</span>
        </label>
        <button
          type="button"
          onClick={onUseCurrent}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-40"
        >
          Use current time
        </button>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max || 1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="w-full accent-sky-600"
      />
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
