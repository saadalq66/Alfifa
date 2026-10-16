import { useEffect, useState } from 'react';
import { ArrowRight, Code, Images, Rotate3d, Share2, ShieldCheck, Sparkles, Wand, Zap } from 'lucide-react';
import { APP_NAME } from '../../config';
import { renderSampleFrames } from '../../lib/sample';
import { SpinViewer } from '../SpinViewer';
import { Button } from '../ui';

export function Logo() {
  return (
    <a href="#top" className="group flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-blue-600/25 transition-transform duration-500 group-hover:rotate-[360deg]">
        <Rotate3d className="h-5 w-5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
    </a>
  );
}

export function Header({ onStart }: { onStart: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="#how"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 sm:block"
          >
            How it works
          </a>
          <Button variant="primary" size="sm" onClick={onStart} className="h-9 px-4">
            Open Studio <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </nav>
      </div>
    </header>
  );
}

function useDemoFrames() {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];
    renderSampleFrames(36, 640, 480, 0.85)
      .then((blobs) => {
        if (cancelled) return;
        created = blobs.map((blob) => URL.createObjectURL(blob));
        setUrls(created);
      })
      .catch((error) => console.error('Could not render the demo spin', error));
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  return urls;
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Hero({ onUpload, onSample }: { onUpload: () => void; onSample: () => void }) {
  const demo = useDemoFrames();

  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.22),transparent)]" />
        <div className="absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="animate-fade-up text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Free · No sign-up · Runs in your browser
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.035em] text-balance text-slate-900 sm:text-5xl lg:text-6xl">
            Turn photos into an interactive{' '}
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">360° spin</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg lg:mx-0">
            Upload a sequence of shots of a car, a watch or any product. Put them in order, remove the
            backgrounds with on-device AI, then share a link or embed the spin on your website.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Button variant="accent" size="lg" onClick={onUpload} icon={<Images className="h-5 w-5" />} className="w-full sm:w-auto">
              Upload photos
            </Button>
            <Button variant="secondary" size="lg" onClick={onSample} icon={<Sparkles className="h-4.5 w-4.5" />} className="w-full sm:w-auto">
              Try a sample
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 lg:justify-start">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Photos stay on your device
            </li>
            <li className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" /> Instant share links
            </li>
            <li className="flex items-center gap-1.5">
              <Code className="h-4 w-4 text-sky-500" /> Embed anywhere
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl animate-fade-up [animation-delay:120ms] lg:max-w-none">
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-sky-200/50 via-transparent to-blue-200/50 blur-2xl" />
          <div className="rounded-[2rem] bg-white/70 p-2.5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 backdrop-blur">
            <SpinViewer
              variant="hero"
              frames={demo}
              fps={14}
              autoplay={!prefersReducedMotion()}
              backdrop="studio"
              aspect={4 / 3}
            />
          </div>
          <div className="absolute -bottom-4 left-6 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-slate-900/5 sm:flex">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-100 text-sky-600">
              <Rotate3d className="h-3.5 w-3.5" />
            </span>
            36 frames · drag me
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Images,
    title: 'Upload & order',
    text: 'Drop in your photo sequence. Files are sorted by name — drag thumbnails to fine-tune the order.',
  },
  {
    icon: Wand,
    title: 'Remove backgrounds',
    text: 'One switch cuts the object out of every frame with an AI model running locally in your browser.',
  },
  {
    icon: Share2,
    title: 'Spin, share & embed',
    text: 'Drag to rotate, auto-play, then copy a view-only link or iframe code — or export everything as a ZIP.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">How it works</h2>
        <p className="mt-3 text-slate-500">Three steps, no accounts, no servers — your photos never leave this tab.</p>
      </div>
      <ol className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li
            key={title}
            className="group relative rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5"
          >
            <span className="absolute right-6 top-6 text-5xl font-semibold tracking-tighter text-slate-100 transition-colors group-hover:text-sky-100">
              {i + 1}
            </span>
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="relative mt-5 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-900/5 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center text-xs text-slate-500 sm:flex-row sm:px-6 sm:text-left">
        <Logo />
        <p className="max-w-xl leading-relaxed">
          Everything runs in your browser. Background removal uses the open-source{' '}
          <a
            className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            href="https://github.com/imgly/background-removal-js"
            target="_blank"
            rel="noopener noreferrer"
          >
            @imgly/background-removal
          </a>{' '}
          (AGPL-3.0); its AI model is downloaded from IMG.LY’s CDN on first use.
        </p>
      </div>
    </footer>
  );
}
