import { forwardRef, useImperativeHandle, useRef, useState, type DragEvent } from 'react';
import { Camera, Images, Layers, Sparkles, Upload } from 'lucide-react';
import { ACCEPTED_TYPES, MAX_FRAMES } from '../config';
import { Button, cx, Spinner } from './ui';

/** Tracks native file drags over an element (nested enter/leave events included). */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return {
    dragging,
    handlers: {
      onDragEnter: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current++;
        setDragging(true);
      },
      onDragOver: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (event: DragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(files);
      },
    },
  };
}

export interface FilePickerHandle {
  open(): void;
}

/** Hidden multi-file input. */
export const FilePicker = forwardRef<FilePickerHandle, { onFiles: (files: File[]) => void }>(
  function FilePicker({ onFiles }, ref) {
    const input = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);
    return (
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length) onFiles(files);
        }}
      />
    );
  },
);

interface DropzoneProps {
  onBrowse: () => void;
  onFiles: (files: File[]) => void;
  onSample: () => void;
  busy: boolean;
}

export function Dropzone({ onBrowse, onFiles, onSample, busy }: DropzoneProps) {
  const { dragging, handlers } = useFileDrop(onFiles);

  return (
    <div className="space-y-6">
      <div
        {...handlers}
        className={cx(
          'relative overflow-hidden rounded-[2rem] border-2 border-dashed bg-white px-6 py-14 text-center transition-all duration-200 sm:py-20',
          dragging
            ? 'scale-[1.01] border-sky-400 bg-sky-50/70 shadow-xl shadow-sky-500/10'
            : 'border-slate-300/80 hover:border-slate-400/80',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.10),transparent_60%)]" />
        <div className="relative mx-auto mb-6 h-20 w-24">
          <div className="absolute inset-x-3 top-2 h-16 -rotate-12 rounded-2xl bg-sky-100 ring-1 ring-sky-200 transition-transform duration-300 group-hover:-rotate-[18deg]" />
          <div className="absolute inset-x-3 top-2 h-16 rotate-12 rounded-2xl bg-blue-100 ring-1 ring-blue-200" />
          <div
            className={cx(
              'absolute inset-x-3 top-1 grid h-16 place-items-center rounded-2xl bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform duration-300',
              dragging && '-translate-y-2 scale-110',
            )}
          >
            <Upload className="h-7 w-7" />
          </div>
        </div>
        <h3 className="relative text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {dragging ? 'Drop to add your photos' : 'Drop your photo sequence here'}
        </h3>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-slate-500">
          Select all the shots at once — JPEG or PNG, up to {MAX_FRAMES} photos. They’re ordered by file name and stay
          on your device.
        </p>
        <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="accent"
            size="lg"
            onClick={onBrowse}
            disabled={busy}
            icon={busy ? <Spinner className="h-4 w-4" /> : <Images className="h-5 w-5" />}
          >
            {busy ? 'Importing…' : 'Choose photos'}
          </Button>
          <Button variant="ghost" size="lg" onClick={onSample} disabled={busy} icon={<Sparkles className="h-4 w-4" />}>
            Try sample photos
          </Button>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Camera,
            title: 'Keep the camera still',
            text: 'Use a tripod and rotate the object — or walk around it at a constant distance.',
          },
          {
            icon: Layers,
            title: 'Shoot 24–72 photos',
            text: 'Even steps (every 5–15°) give the smoothest spin. More photos, more fluid.',
          },
          {
            icon: Sparkles,
            title: 'Plain background helps',
            text: 'Background removal works best when the object stands out clearly.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-900/5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
