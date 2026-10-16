import { useCallback, useEffect, useRef } from 'react';
import { FilePicker, type FilePickerHandle } from './components/Dropzone';
import { Footer, Header, Hero, HowItWorks } from './components/landing/Landing';
import { Studio } from './components/Studio';
import { ToastProvider, useToast } from './components/Toast';
import { MAX_FRAMES } from './config';
import { useFrames, type ImportResult } from './hooks/useFrames';
import { renderSampleFrames } from './lib/sample';

export default function EditorApp() {
  return (
    <ToastProvider>
      <Editor />
    </ToastProvider>
  );
}

function Editor() {
  const store = useFrames();
  const toast = useToast();
  const picker = useRef<FilePickerHandle>(null);
  const studio = useRef<HTMLElement>(null);
  const hasFrames = store.frames.length > 0;

  useEffect(() => {
    if (!hasFrames) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasFrames]);

  const scrollToStudio = useCallback(() => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    studio.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const report = useCallback(
    ({ added, skipped, truncated }: ImportResult) => {
      if (truncated) toast(`Projects are limited to ${MAX_FRAMES} frames — extra photos were skipped.`, 'info');
      if (skipped.length) {
        const names = skipped.slice(0, 2).join(', ') + (skipped.length > 2 ? ` and ${skipped.length - 2} more` : '');
        toast(`Skipped ${names} — only JPEG, PNG and WebP images can be imported.`, 'error');
      } else if (added) {
        toast(`Added ${added} photo${added === 1 ? '' : 's'}`);
      }
    },
    [toast],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!hasFrames) scrollToStudio();
      void store.addFiles(files).then(report);
    },
    [hasFrames, store.addFiles, report, scrollToStudio],
  );

  const loadSample = useCallback(async () => {
    if (hasFrames && !window.confirm('Replace your current frames with the sample photos?')) return;
    store.clear();
    scrollToStudio();
    const blobs = await renderSampleFrames(36, 1200, 900);
    const result = await store.importSources(
      blobs.map((blob, i) => ({ blob, name: `sample-${String(i + 1).padStart(2, '0')}.jpg` })),
    );
    report(result);
  }, [hasFrames, store.clear, store.importSources, report, scrollToStudio]);

  // Opening the picker must happen synchronously inside the click (Safari is strict).
  const browse = useCallback(() => picker.current?.open(), []);
  const uploadFromHero = useCallback(() => {
    browse();
    scrollToStudio();
  }, [browse, scrollToStudio]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header onStart={scrollToStudio} />
      <main className="flex-1">
        <Hero onUpload={uploadFromHero} onSample={loadSample} />
        <HowItWorks />
        <section ref={studio} id="studio" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Studio</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {hasFrames ? 'Your 360° spin' : 'Create your spin'}
              </h2>
            </div>
          </div>
          <Studio store={store} onBrowse={browse} onFiles={handleFiles} onSample={loadSample} />
        </section>
      </main>
      <Footer />
      <FilePicker ref={picker} onFiles={handleFiles} />
    </div>
  );
}
