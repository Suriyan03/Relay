import { useCallback, useEffect, useState } from 'react';
import { Zap, Sparkles, Mail, MessageSquareReply } from 'lucide-react';
import { api } from '../lib/api';
import { useData } from '../context/Data.jsx';
import { useToast } from '../context/Toast.jsx';
import { Button, ErrorBanner, Modal } from './ui.jsx';
import { Chip } from './badges.jsx';
import { OWNER } from '../lib/segments';

export function SimulateButton({ onOpenThread }) {
  const { refresh } = useData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const r = await api('/simulate/scenarios');
      setItems(r.scenarios);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  async function run(s) {
    setRunning(s.id);
    setResult(null);
    try {
      const r = await api('/simulate', { method: 'POST', body: { scenario: s.id } });
      setResult(r);
      await refresh();
      loadList();
    } catch (e) {
      toast({ tone: 'error', title: 'That did not work', description: e.message });
    } finally {
      setRunning(null);
    }
  }

  const label = (o) => OWNER[o]?.label || o;

  return (
    <>
      <Button variant="ghost" size="sm" icon={Zap} title="Simulate incoming email" aria-label="Simulate incoming email" onClick={() => setOpen(true)}>
        <span className="hidden xl:inline">Simulate email</span>
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        width="max-w-2xl"
        title="Simulate incoming email"
        description="Drop a new email into the inbox and watch Relay sort it. Nothing real is sent or received."
      >
        {error && <div className="mb-3"><ErrorBanner message={error} onRetry={loadList} /></div>}

        {result && (
          <div className="mb-4 rounded-xl border border-orchid-200 bg-orchid-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-orchid-700">
              <Sparkles className="h-4 w-4" aria-hidden /> Relay sorted it
            </p>
            <p className="mt-1.5 text-sm font-medium text-ink">"{result.subject}"</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              {result.before == null ? (
                <>Classified as <strong>{label(result.after)}</strong>.</>
              ) : result.before !== result.after ? (
                <>Was <strong>{label(result.before)}</strong>, now <strong>{label(result.after)}</strong>.</>
              ) : (
                <>Still <strong>{label(result.after)}</strong>.</>
              )}
              {result.needsReview && ' The AI was not sure, so it flagged this for your review.'}
              {result.suggestion && ` Your manual choice was kept. The AI suggests "${label(result.suggestion.responsibility)}".`}
            </p>
            <Button
              size="sm"
              variant="ai"
              className="mt-3"
              onClick={() => {
                onOpenThread(result.threadId);
                setOpen(false);
              }}
            >
              Open conversation
            </Button>
          </div>
        )}

        {!items && !error && <p className="py-6 text-center text-sm text-ink-mute">Loading scenarios...</p>}

        <ul className="space-y-2.5 pb-2">
          {items?.map((s) => (
            <li key={s.id} className="flex items-start gap-3 rounded-xl border border-line p-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                {s.kind === 'reply' ? <MessageSquareReply className="h-4 w-4" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <Chip tone={s.kind === 'reply' ? 'cobalt' : 'slate'}>{s.kind === 'reply' ? 'Reply' : 'New email'}</Chip>
                </div>
                <p className="mt-0.5 text-[13px] leading-5 text-ink-mute">{s.description}</p>
                {!s.available && <p className="mt-1 text-xs text-marigold-700">Not available right now, the conversation it replies to is missing.</p>}
              </div>
              <Button size="sm" variant="secondary" disabled={!s.available || !!running} loading={running === s.id} onClick={() => run(s)}>
                Run
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}