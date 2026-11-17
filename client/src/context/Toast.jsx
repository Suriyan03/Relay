import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = { success: 'text-emerald-600', error: 'text-rose-600', info: 'text-cobalt-600' };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setItems((x) => x.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'success', action, duration = 4200 }) => {
      const id = Math.random().toString(36).slice(2);
      setItems((x) => [...x.slice(-2), { id, title, description, tone, action }]);
      timers.current[id] = setTimeout(() => dismiss(id), action ? Math.max(duration, 7000) : duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 px-4 pb-24 lg:items-end lg:pb-6 lg:pr-6" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg bg-ink px-4 py-3 text-white shadow-pop">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.tone === 'success' ? 'text-emerald-400' : t.tone === 'error' ? 'text-rose-400' : 'text-cobalt-200'}`} aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium leading-5">{t.title}</p>
                {t.description && <p className="mt-0.5 leading-5 text-white/70">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                  className="rounded px-2 py-0.5 text-sm font-semibold text-marigold-200 hover:bg-white/10"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-white/50 hover:text-white" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
