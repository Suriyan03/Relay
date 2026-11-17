import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { initials } from '../lib/format';

export const cx = (...a) => a.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-ink-soft active:bg-black disabled:bg-ink/40',
  secondary: 'bg-white text-ink ring-1 ring-inset ring-line hover:bg-slate-50 active:bg-slate-100 disabled:text-ink-faint',
  ghost: 'text-ink-soft hover:bg-slate-900/5 active:bg-slate-900/10 disabled:text-ink-faint',
  ai: 'bg-orchid-600 text-white hover:bg-orchid-700 active:bg-orchid-700 disabled:bg-orchid-600/40',
  cobalt: 'bg-cobalt-600 text-white hover:bg-cobalt-700 disabled:bg-cobalt-600/40',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40',
  soft: 'bg-slate-900/5 text-ink hover:bg-slate-900/10',
};
const SIZES = { sm: 'h-8 gap-1.5 px-3 text-[13px]', md: 'h-10 gap-2 px-4 text-sm', lg: 'h-12 gap-2 px-6 text-[15px]' };

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, children, className, ...rest }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed', VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, active, className, tone, ...rest }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
        active ? 'bg-marigold-100 text-marigold-700' : 'text-ink-mute hover:bg-slate-900/5 hover:text-ink',
        className,
      )}
    >
      <Icon className={cx('h-[18px] w-[18px]', active && tone === 'star' && 'fill-marigold-400')} aria-hidden />
    </button>
  );
}

const AVATAR_COLORS = ['bg-cobalt-100 text-cobalt-700', 'bg-marigold-100 text-marigold-700', 'bg-orchid-100 text-orchid-700', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-slate-200 text-slate-700'];
export function Avatar({ name = '', size = 36, className }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', AVATAR_COLORS[h % AVATAR_COLORS.length], className)}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx('animate-spin text-ink-mute', className || 'h-5 w-5')} aria-label="Loading" />;
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} />;
}

export function EmptyState({ icon: Icon, title, body, action, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-100 text-slate-500', cobalt: 'bg-cobalt-50 text-cobalt-600', marigold: 'bg-marigold-50 text-marigold-700', orchid: 'bg-orchid-50 text-orchid-600', green: 'bg-emerald-50 text-emerald-600' };
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className={cx('mb-4 flex h-12 w-12 items-center justify-center rounded-full', tones[tone])}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm leading-6 text-ink-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1 leading-5">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-lg' }) {
  useEscape(open, onClose);
  useLockScroll(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/45" onClick={onClose} />
      <div className={cx('relative flex max-h-[92dvh] w-full animate-pop flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', width)}>
        <div className="flex items-start gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-6">{title}</h2>
            {description && <p className="mt-1 text-sm leading-5 text-ink-mute">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-ink-mute hover:bg-slate-900/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line-soft px-6 py-4 sm:flex-row sm:justify-end pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand drawer on desktop, full-height sheet on mobile. */
export function Sheet({ open, onClose, title, subtitle, children, footer, width = 'sm:max-w-[440px]' }) {
  useEscape(open, onClose);
  useLockScroll(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/35" onClick={onClose} />
      <aside className={cx('absolute inset-y-0 right-0 flex w-full animate-slide-left flex-col bg-white shadow-sheet', width)}>
        <header className="flex items-center gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0 flex-1">{title}{subtitle}</div>
          <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-ink-mute hover:bg-slate-900/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line-soft p-4 pb-safe">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

export function Popover({ trigger, children, align = 'right', width = 'w-80', onOpenChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const set = (v) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  useEffect(() => {
    if (!open) return;
    const click = (e) => ref.current && !ref.current.contains(e.target) && set(false);
    const key = (e) => e.key === 'Escape' && set(false);
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => set(!open) })}
      {open && (
        <div className={cx('absolute z-50 mt-2 max-w-[calc(100vw-1.5rem)] animate-pop rounded-xl border border-line bg-white shadow-pop', width, align === 'right' ? 'right-0' : 'left-0')}>
          {typeof children === 'function' ? children({ close: () => set(false) }) : children}
        </div>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-cobalt-600' : 'bg-slate-300')}>
      <span className={cx('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  );
}
