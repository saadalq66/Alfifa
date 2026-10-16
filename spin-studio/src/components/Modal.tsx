import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

/** Native <dialog>: focus trapping, Escape and top-layer stacking for free. */
export function Modal({ open, onClose, title, description, icon, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(calc(100%-1.5rem),60rem)] overflow-visible bg-transparent p-0 text-slate-700 backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm open:animate-fade-up"
    >
      {open && (
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5">
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-100 bg-white/90 px-5 py-4 backdrop-blur sm:px-7 sm:py-5">
            {icon && (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/25">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:rotate-90 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
