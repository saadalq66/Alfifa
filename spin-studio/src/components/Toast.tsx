import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cx } from './ui';

type ToastKind = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const ICONS = { success: CircleCheck, info: Info, error: TriangleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-slate-900/20"
            >
              <Icon
                className={cx(
                  'h-4.5 w-4.5 shrink-0',
                  toast.kind === 'success' && 'text-emerald-400',
                  toast.kind === 'info' && 'text-sky-300',
                  toast.kind === 'error' && 'text-amber-400',
                )}
              />
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
