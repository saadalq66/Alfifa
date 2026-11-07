import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePicker, type FilePickerHandle } from './components/Dropzone';
import { Footer, Header, Hero, HowItWorks } from './components/landing/Landing';
import { Studio } from './components/Studio';
import { ToastProvider, useToast } from './components/Toast';
import { VideoImportModal } from './components/VideoImportModal';
import { MAX_FRAMES } from './config';
import { useFrames, type ImportResult } from './hooks/useFrames';
import { renderSampleFrames } from './lib/sample';
import { isVideoFile } from './lib/videoFrames';

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
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
    ({ added, skipped, truncated }: ImportResult, noun = 'photo') => {
      if (truncated) toast(`Projects are limited to ${MAX_FRAMES} frames — extra photos were skipped.`, 'info');
      if (skipped.length) {
        const names = skipped.slice(0, 2).join(', ') + (skipped.length > 2 ? ` and ${skipped.length - 2} more` : '');
        toast(`Skipped ${names} — only JPEG, PNG and WebP images can be imported.`, 'error');
      } else if (added) {
        toast(`Added ${added} ${noun}${added === 1 ? '' : 's'}`);
      }
    },
    [toast],
  );

  // Pictures are imported straight away; a video first opens the dialog that
  // picks one full turn and turns it into frames.
  const handleFiles = useCallback(
    (files: File[]) => {
      const videos = files.filter(isVideoFile);
      const pictures = files.filter((file) => !isVideoFile(file));
      if (videos.length) {
        setVideoFile(videos[0]);
        if (videos.length > 1) toast('Videos are imported one at a time — using the first one.', 'info');
      }
      if (pictures.length) {
        if (!hasFrames) scrollToStudio();
        void store.addFiles(pictures).then(report);
      }
    },
    [hasFrames, store.addFiles, report, scrollToStudio, toast],
  );

  const importVideoFrames = useCallback(
    async (frames: Blob[], replace: boolean) => {
      const base = (videoFile?.name ?? 'video').replace(/\.[^.]+$/, '');
      setVideoFile(null);
      if (replace) store.clear();
      scrollToStudio();
      const digits = Math.max(3, String(frames.length).length);
      const result = await store.importSources(
        frames.map((blob, i) => ({ blob, name: `${base}-frame-${String(i + 1).padStart(digits, '0')}.jpg` })),
      );
      report(result, 'frame');
    },
    [videoFile, store.clear, store.importSources, report, scrollToStudio],
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
      <VideoImportModal
        file={videoFile}
        existingCount={store.frames.length}
        onClose={() => setVideoFile(null)}
        onExtracted={importVideoFrames}
      />
    </div>
  );
}
