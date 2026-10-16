import { useEffect, useState } from 'react';
import { Rotate3d, TriangleAlert } from 'lucide-react';
import { SpinViewer } from './components/SpinViewer';
import { APP_NAME } from './config';
import { currentAppUrl } from './lib/share';
import { decodeSharePayload, ShareLinkError, type SharePayload } from './lib/sharePayload';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: SharePayload; urls: string[]; aspect: number };

/**
 * View-only mode for share links and iframes: nothing but the interactive
 * viewer, filling the whole window.
 */
export default function ViewerApp({ encoded }: { encoded: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('embed');
    document.title = '360° view';
    return () => root.classList.remove('embed');
  }, []);

  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    (async () => {
      const payload = decodeSharePayload(encoded);
      urls = payload.frames.map((bytes) =>
        URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: payload.format })),
      );
      const aspect = await measure(urls[0]);
      if (!cancelled) setState({ status: 'ready', payload, urls, aspect });
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error(error);
      setState({
        status: 'error',
        message:
          error instanceof ShareLinkError ? error.message : 'The images in this link could not be read.',
      });
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [encoded]);

  if (state.status === 'error') {
    return (
      <main className="grid h-full place-items-center bg-slate-50 p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">This 360° link can’t be opened</h1>
          <p className="mt-2 text-sm text-slate-500">{state.message}</p>
          <a
            href={currentAppUrl()}
            target="_blank"
            rel="noopener"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Rotate3d className="h-4 w-4" /> Create a spin with {APP_NAME}
          </a>
        </div>
      </main>
    );
  }

  if (state.status === 'loading') {
    return (
      <main className="grid h-full place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-300/60 border-t-sky-500" />
      </main>
    );
  }

  const { payload, urls, aspect } = state;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <main className="h-full">
      <SpinViewer
        variant="embed"
        frames={urls}
        fps={payload.fps}
        invertDrag={payload.invertDrag}
        autoplay={payload.autoplay && !reducedMotion}
        backdrop={payload.backdrop}
        aspect={aspect}
      />
    </main>
  );
}

function measure(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => reject(new Error('Invalid image data'));
    img.src = url;
  });
}
