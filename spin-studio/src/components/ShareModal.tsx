import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Code, Copy, ExternalLink, Link2, Lock, Share2, TriangleAlert } from 'lucide-react';
import {
  buildEmbedCode,
  buildShareUrl,
  encodeShareFrames,
  formatBytes,
  SHARE_PRESETS,
  URL_HARD_LIMIT,
  URL_SOFT_LIMIT,
  type SharePresetId,
} from '../lib/share';
import type { ViewerSettings } from '../types';
import { Modal } from './Modal';
import { SpinViewer } from './SpinViewer';
import { useToast } from './Toast';
import { Button, cx, Spinner, Switch } from './ui';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  sources: Blob[];
  settings: ViewerSettings;
  /** Frames are cut-outs, so a transparent backdrop keeps an alpha channel. */
  hasCutouts: boolean;
}

interface Generated {
  url: string;
  embed: string;
  width: number;
  height: number;
  frameCount: number;
}

const REDUCE_FRAMES_THRESHOLD = 24;

export function ShareModal({ open, onClose, sources, settings, hasCutouts }: ShareModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Share2 className="h-5 w-5" />}
      title="Share Project"
      description="A view-only link and embed code — everything lives inside the link, nothing is uploaded."
    >
      {open && <ShareBody sources={sources} settings={settings} hasCutouts={hasCutouts} />}
    </Modal>
  );
}

function ShareBody({
  sources,
  settings,
  hasCutouts,
}: {
  sources: Blob[];
  settings: ViewerSettings;
  hasCutouts: boolean;
}) {
  const toast = useToast();
  const [preset, setPreset] = useState<SharePresetId>(sources.length > 48 ? 'small' : 'balanced');
  const [autoplay, setAutoplay] = useState(true);
  const [reduceFrames, setReduceFrames] = useState(sources.length > 48);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const job = useRef(0);

  const canReduce = sources.length > REDUCE_FRAMES_THRESHOLD;
  const selected = useMemo(
    () => (canReduce && reduceFrames ? sources.filter((_, i) => i % 2 === 0) : sources),
    [sources, canReduce, reduceFrames],
  );

  // Re-encode only when the image inputs change; toggling autoplay just rebuilds the link.
  const [encoded, setEncoded] = useState<Awaited<ReturnType<typeof encodeShareFrames>> | null>(null);
  useEffect(() => {
    const id = ++job.current;
    setBusy(true);
    setError(null);
    encodeShareFrames(selected, preset, settings.backdrop)
      .then((result) => id === job.current && setEncoded(result))
      .catch((err: unknown) => {
        if (id !== job.current) return;
        console.error(err);
        setError('Could not prepare the share link. Try a smaller quality setting.');
      })
      .finally(() => id === job.current && setBusy(false));
  }, [selected, preset, settings.backdrop]);

  // Object URLs for the preview depend only on the encoded frames, so toggling
  // autoplay never reloads the preview.
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!encoded) return;
    const urls = encoded.frames.map((bytes) =>
      URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: encoded.format })),
    );
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [encoded]);

  // Keep the time for one full turn the same when frames are skipped.
  const fps = encoded
    ? Math.max(1, Math.round(settings.fps * (encoded.frames.length / sources.length)))
    : settings.fps;

  const generated = useMemo<Generated | null>(() => {
    if (!encoded) return null;
    const url = buildShareUrl({
      autoplay,
      invertDrag: settings.invertDrag,
      backdrop: settings.backdrop,
      fps,
      format: encoded.format,
      frames: encoded.frames,
    });
    return {
      url,
      embed: buildEmbedCode(url, encoded.width, encoded.height),
      width: encoded.width,
      height: encoded.height,
      frameCount: encoded.frames.length,
    };
  }, [encoded, autoplay, settings.invertDrag, settings.backdrop, fps]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied to clipboard`);
    } catch {
      toast('Copy failed — select the text and copy it manually.', 'error');
    }
  };

  const length = generated?.url.length ?? 0;
  const tooLong = length > URL_HARD_LIMIT;
  const long = length > URL_SOFT_LIMIT;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-8">
      <div className="space-y-3">
        <div className="relative">
          {generated ? (
            <SpinViewer
              variant="preview"
              frames={previewUrls}
              fps={fps}
              invertDrag={settings.invertDrag}
              backdrop={settings.backdrop}
              aspect={generated.width / generated.height}
            />
          ) : (
            <div className="aspect-[4/3] w-full animate-shimmer rounded-[1.75rem] bg-[linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9)]" />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-[1.75rem] bg-white/50 backdrop-blur-[2px]">
              <span className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-md">
                <Spinner className="h-3.5 w-3.5 text-sky-600" /> Optimizing frames…
              </span>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-500">Preview — exactly what people opening the link will see.</p>
      </div>

      <div className="min-w-0 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-900">Link quality</legend>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
            {SHARE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={preset === p.id}
                className={cx(
                  'rounded-xl px-2 py-2 text-center transition',
                  preset === p.id
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="block text-[11px] text-slate-500">{p.maxEdge}px</span>
              </button>
            ))}
          </div>
          {hasCutouts && settings.backdrop === 'transparent' && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Transparent frames make links about 4× longer. Choose a solid backdrop in the studio for a shorter link.
            </p>
          )}
        </fieldset>

        <div className="space-y-4 rounded-2xl border border-slate-200/80 p-4">
          <Switch
            id="share-autoplay"
            checked={autoplay}
            onChange={setAutoplay}
            label="Auto-rotate on load"
            description="Viewers can still drag to take control."
          />
          {canReduce && (
            <Switch
              id="share-reduce"
              checked={reduceFrames}
              onChange={setReduceFrames}
              label="Use every other frame"
              description={`${Math.ceil(sources.length / 2)} instead of ${sources.length} frames — roughly halves the link.`}
            />
          )}
        </div>

        <div
          className={cx(
            'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium',
            tooLong ? 'bg-red-50 text-red-700' : long ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800',
          )}
        >
          {tooLong || long ? <TriangleAlert className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>
            {generated ? (
              <>
                Link size <strong className="tabular-nums">{formatBytes(length)}</strong> ·{' '}
                {generated.frameCount} frames at {generated.width}×{generated.height}
                {tooLong
                  ? ' — too long for most browsers. Pick a smaller quality or fewer frames.'
                  : long
                    ? ' — fine for websites and embeds, but chat apps may cut it off.'
                    : ''}
              </>
            ) : (
              'Calculating link size…'
            )}
          </span>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div>
          <label htmlFor="share-url" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Link2 className="h-4 w-4 text-slate-400" /> View-Only Share Link
          </label>
          <div className="flex gap-2">
            <input
              id="share-url"
              readOnly
              value={generated?.url ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-600 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20"
            />
            <Button
              variant="primary"
              disabled={!generated || busy}
              onClick={() => generated && copy(generated.url, 'Link')}
              icon={<Copy className="h-4 w-4" />}
            >
              Copy
            </Button>
            <a
              href={generated && !busy ? generated.url : undefined}
              target="_blank"
              rel="noopener"
              aria-disabled={!generated || busy}
              aria-label="Open link in a new tab"
              title="Open in a new tab"
              className={cx(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95',
                (!generated || busy) && 'pointer-events-none opacity-45',
              )}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <label htmlFor="share-embed" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Code className="h-4 w-4 text-slate-400" /> Embed Code
          </label>
          <div className="relative">
            <textarea
              id="share-embed"
              readOnly
              rows={4}
              value={generated?.embed ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              className="block w-full resize-none rounded-xl border border-slate-200 bg-slate-950 p-3 pr-24 font-mono text-[11px] leading-relaxed break-all text-sky-100 outline-none focus:ring-4 focus:ring-sky-400/30"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!generated || busy}
              onClick={() => generated && copy(generated.embed, 'Embed code')}
              icon={<Copy className="h-3.5 w-3.5" />}
              className="absolute right-2 top-2"
            >
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Paste into any website or CMS that allows HTML. The embed scales to the width of its container.
          </p>
        </div>

        <p className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          The frames are compressed into the part of the link after “#”, which browsers never send to any
          server. Anyone with the link can view the spin; nobody can edit it.
        </p>
      </div>
    </div>
  );
}
