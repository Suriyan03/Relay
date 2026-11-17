import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCheck, UserCog, ChevronDown, Star, CalendarClock, Inbox, Link2Off, Undo2, Sparkles } from 'lucide-react';
import { api, setSession } from '../lib/api';
import { useToast } from '../context/Toast.jsx';
import { Avatar, Button, EmptyState, ErrorBanner, Modal, Spinner, cx } from '../components/ui.jsx';
import { Chip, Logo } from '../components/badges.jsx';
import { dayLabel, firstName, greeting, plural, shortTime, timeAgo } from '../lib/format';

export default function ClientPortal() {
  const { token } = useParams();
  const { toast } = useToast();
  const [linked, setLinked] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [delegating, setDelegating] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);

  // 1) Exchange the invite token for a client session.
  useEffect(() => {
    let alive = true;
    api('/auth/client-link', { method: 'POST', body: { inviteToken: token }, auth: false })
      .then((s) => {
        setSession('client', s);
        if (alive) setLinked(true);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  const load = useCallback(async () => {
    try {
      setData(await api('/client/overview', { role: 'client' }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // 2) Load the overview and keep it fresh.
  useEffect(() => {
    if (!linked) return;
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 6000);
    return () => clearInterval(id);
  }, [linked, load]);

  async function act(id, path, body) {
    setBusy(id);
    try {
      await api(`/client/threads/${id}/${path}`, { method: 'POST', role: 'client', body });
      await load();
      return true;
    } catch (e) {
      toast({ tone: 'error', title: 'That did not work', description: e.message });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handled(c) {
    if (await act(c.id, 'handled')) {
      toast({ title: 'Marked as handled', action: { label: 'Undo', onClick: () => act(c.id, 'undo') } });
    }
  }

  async function delegate() {
    const c = delegating;
    if (await act(c.id, 'delegate', { note })) {
      setDelegating(null);
      setNote('');
      toast({ title: `${firstName(data.assistantName)} will take it from here`, action: { label: 'Undo', onClick: () => act(c.id, 'undo') } });
    }
  }

  if (error && !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <EmptyState icon={Link2Off} title="This link does not work" body={error} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const assistant = firstName(data.assistantName);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <Logo />
        <span className="text-sm text-ink-mute">{data.clientName}</span>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <h1 className="text-[28px] font-semibold leading-tight">
          {greeting()}, {firstName(data.clientName)}
        </h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          {data.pending.length === 0 ? 'You are all caught up.' : `${plural(data.pending.length, 'conversation')} need${data.pending.length === 1 ? 's' : ''} a reply from you.`}
          {data.assistantCount > 0 && ` ${assistant} is handling ${data.assistantCount} more for you.`}
        </p>

        {error && <div className="mt-4"><ErrorBanner message={error} onRetry={load} /></div>}

        <div className="mt-6 space-y-3">
          {!data.connected ? (
            <EmptyState icon={Inbox} title="Your inbox is not connected yet" body={`${assistant} needs to connect your email first.`} />
          ) : data.pending.length === 0 ? (
            <EmptyState icon={CheckCheck} tone="green" title="Nothing needs you" body="New emails that need your reply will show up here." />
          ) : (
            data.pending.map((c) => {
              const open = expanded === c.id;
              const due = c.deadline?.iso;
              return (
                <article key={c.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={c.counterpart?.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-mute">{c.counterpart?.name} · {timeAgo(c.lastMessageAt)}</p>
                        <h2 className="text-[17px] font-semibold leading-snug">{c.subject}</h2>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.important && <Chip tone="marigold" icon={Star}>Important</Chip>}
                          {due && <Chip tone="marigold" icon={CalendarClock}>Due {dayLabel(due)}</Chip>}
                          {c.category && <Chip>{c.category}</Chip>}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-[15px] leading-6 text-ink-soft">{c.summary}</p>
                    {c.reason && (
                      <p className="mt-2 flex gap-2 text-[13px] leading-5 text-orchid-700">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {c.reason}
                      </p>
                    )}

                    <button onClick={() => setExpanded(open ? null : c.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cobalt-600 hover:underline" aria-expanded={open}>
                      {open ? 'Hide the emails' : 'Read the emails'} <ChevronDown className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
                    </button>

                    {open && (
                      <ol className="mt-3 space-y-3">
                        {c.messages.map((m) => (
                          <li key={m.id} className={cx('rounded-xl border p-3.5', m.direction === 'out' ? 'border-cobalt-200 bg-cobalt-50/40' : 'border-line bg-canvas')}>
                            <p className="text-sm font-semibold">
                              {m.from.name} <span className="font-normal text-ink-mute">· {shortTime(m.at)}</span>
                            </p>
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{m.body}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-line-soft bg-slate-50/60 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                    <Button icon={UserCog} onClick={() => { setDelegating(c); setNote(''); }}>Ask {assistant} to handle</Button>
                    <Button variant="primary" icon={CheckCheck} loading={busy === c.id} onClick={() => handled(c)}>I have handled this</Button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {data.recent.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-ink-soft">Your recent actions</h2>
            <ul className="mt-2 divide-y divide-line-soft rounded-xl border border-line bg-white">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.subject}</p>
                    <p className="text-xs text-ink-mute">
                      {r.type === 'handled' ? 'You handled this' : `Handed to ${assistant}`} · {timeAgo(r.at)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" icon={Undo2} loading={busy === r.id} onClick={() => act(r.id, 'undo')}>Undo</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-center text-xs text-ink-faint">This is your private page. Only emails that need your reply appear here.</p>
      </main>

      <Modal
        open={!!delegating}
        onClose={() => setDelegating(null)}
        title={`Ask ${assistant} to handle this`}
        description={delegating?.subject}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDelegating(null)}>Cancel</Button>
            <Button variant="primary" loading={busy === delegating?.id} onClick={delegate}>Hand it over</Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Note for {assistant} (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="e.g. Approve it, but ask them to keep the variable at 15%."
            className="w-full resize-none rounded-lg border border-line bg-white px-3.5 py-3 text-sm placeholder:text-ink-faint focus:border-cobalt-500 focus:outline-none focus:ring-2 focus:ring-cobalt-500/20"
          />
        </label>
      </Modal>
    </div>
  );
}