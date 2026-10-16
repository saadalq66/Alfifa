import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 shadow-slate-900/10',
  accent:
    'bg-gradient-to-b from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/25 hover:from-sky-400 hover:to-blue-600',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900',
  ghost: 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-base',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id: string;
}

export function Switch({ checked, onChange, label, description, disabled, id }: SwitchProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className={cx('min-w-0 cursor-pointer', disabled && 'cursor-default opacity-60')}>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40 disabled:opacity-50',
          checked ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-slate-200 hover:bg-slate-300',
        )}
      >
        <span
          className={cx(
            'h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-slate-900/5 transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}

/** Circular progress with a spinning highlight, so long stages still feel alive. */
export function ProgressRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span
        aria-hidden
        className="absolute inset-[3px] animate-spin rounded-full border-2 border-transparent border-t-white/70 [animation-duration:1.4s]"
      />
      <span className="absolute text-[10px] font-bold tabular-nums text-white">{Math.round(value * 100)}%</span>
    </span>
  );
}
