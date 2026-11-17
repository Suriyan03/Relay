import { useState } from 'react';
import { ArrowLeft, Sparkles, Inbox, Star, Archive, CheckCheck, RotateCcw, Check, History, Mail, MailOpen } from 'lucide-react';
import { OwnerBadge, ReviewBadge, TagChips, ConfidenceMeter } from './badges';
import { Avatar, Button, EmptyState, IconButton, cx } from './ui';
import { useData } from '../context/Data.jsx';
import { useToast } from '../context/Toast.jsx';
import { ReplyComposer } from './ReplyComposer.jsx';
import { ThreadInsights } from './ThreadInsights.jsx';
import { OWNER } from '../lib/segments';
import { shortTime } from '../lib/format';

const OWNERS = ['assistant', 'client', 'none'];

export function ThreadDetail({ thread, onBack }) {
  const { patchThread, threadAction } = useData();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={Inbox} title="Select a conversation" body="Pick an email on the left to see who should reply and why." />
      </div>
    );
  }
  const t = thread;

  async function track(key, fn) {
    setBusy(key);
    try {
      return await fn();
    } finally {
      setBusy(null);
    }
  }

  async function setOwner(next) {
    if (next === t.responsibility) return;
    const prev = t.responsibility;
    const r = await track('owner', () => threadAction(t._id, 'override', { responsibility: next }));
    if (r) {
      toast({
        title: `Reply owner changed to "${OWNER[next].label}"`,
        action: { label: 'Undo', onClick: () => threadAction(t._id, 'override', { responsibility: prev }) },
      });
    }
  }

  async function useAi() {
    const r = await track('auto', () => threadAction(t._id, 'override', { responsibility: 'auto' }));
    if (r) toast({ title: 'Back to the AI’s choice' });
  }

  async function confirm() {
    const r = await track('confirm', () => patchThread(t._id, { reviewed: true }));
    if (r) toast({ title: 'Confirmed. Thanks for checking.' });
  }

  async function reclassify() {
    const r = await track('recheck', () => threadAction(t._id, 'reclassify'));
    if (r) toast({ title: 'AI re-checked this conversation' });
  }

  async function setStatus(status, message) {
    const prev = t.status;
    const r = await track(status, () => patchThread(t._id, { status }));
    if (r) {
      toast({ title: message, action: { label: 'Undo', onClick: () => patchThread(t._id, { status: prev }) } });
      if (status !== 'open') onBack?.();
    }
  }

  function toggleUnread() {
    const next = !t.unread;
    patchThread(t._id, { unread: next });
    toast({ title: next ? 'Marked as unread' : 'Marked as read' });
  }

  const suggestion = t.suggestion;
  const needsConfirm = t.needsReview && !t.reviewed;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-line-soft bg-white px-5 py-4">
        <div className="flex items-start gap-2">
          <IconButton icon={ArrowLeft} label="Back to list" onClick={onBack} className="-ml-2 lg:hidden" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold leading-snug">{t.subject}</h2>
            <p className="mt-0.5 text-sm text-ink-mute">
              {t.counterpart?.name} {t.counterpart?.email ? `· ${t.counterpart.email}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <OwnerBadge owner={t.responsibility} />
              {needsConfirm && <ReviewBadge />}
              <TagChips thread={t} />
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            <IconButton icon={t.unread ? MailOpen : Mail} label={t.unread ? 'Mark as read' : 'Mark as unread'} onClick={toggleUnread} />
            <IconButton
              icon={Star}
              tone="star"
              label={t.important ? 'Remove from important' : 'Mark as important'}
              active={t.important}
              onClick={() => patchThread(t._id, { important: !t.important })}
            />
          </div>
        </div>

        {/* Reply owner control */}
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">Who should reply</p>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Reply owner" className="inline-flex rounded-lg bg-slate-900/5 p-1">
              {OWNERS.map((o) => {
                const Icon = OWNER[o].icon;
                const on = t.responsibility === o;
                return (
                  <button
                    key={o}
                    role="radio"
                    aria-checked={on}
                    disabled={busy === 'owner'}
                    onClick={() => setOwner(o)}
                    className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60', on ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink')}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {OWNER[o].short}
                  </button>
                );
              })}
            </div>
            {t.override && (
              <button onClick={useAi} disabled={busy === 'auto'} className="text-[13px] font-medium text-orchid-700 hover:underline disabled:opacity-60">
                Let the AI decide
              </button>
            )}
          </div>
          {t.override && <p className="mt-1.5 text-xs text-ink-mute">You chose this. The AI keeps its own opinion but will not overwrite yours.</p>}
        </div>

        {/* Secondary actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {t.status === 'open' ? (
            <>
              <Button size="sm" icon={CheckCheck} loading={busy === 'completed'} onClick={() => setStatus('completed', 'Marked as completed')}>Complete</Button>
              <Button size="sm" icon={Archive} loading={busy === 'archived'} onClick={() => setStatus('archived', 'Archived')}>Archive</Button>
            </>
          ) : (
            <Button size="sm" icon={RotateCcw} loading={busy === 'open'} onClick={() => setStatus('open', 'Reopened')}>Reopen</Button>
          )}
          <Button size="sm" variant="ghost" icon={Sparkles} loading={busy === 'recheck'} onClick={reclassify}>Re-check with AI</Button>
        </div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {suggestion && (
          <section className="rounded-xl border border-orchid-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-orchid-700">
              <Sparkles className="h-4 w-4" aria-hidden /> AI suggests a change
            </p>
            <p className="mt-1.5 text-sm leading-6 text-ink-soft">
              After the latest message, the AI thinks this should be <strong>{OWNER[suggestion.responsibility].label}</strong> ({Math.round(suggestion.confidence * 100)}% sure). {suggestion.reason}
            </p>
            <div className="mt-3">
              <Button size="sm" variant="ai" icon={Check} loading={busy === 'owner'} onClick={() => setOwner(suggestion.responsibility)}>
                Switch to “{OWNER[suggestion.responsibility].short}”
              </Button>
            </div>
          </section>
        )}

        {t.ai && (
          <section className="rounded-xl border border-orchid-200 bg-orchid-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-orchid-700">
              <Sparkles className="h-4 w-4" aria-hidden /> Why Relay chose this
              <span className="ml-auto"><ConfidenceMeter value={t.ai.confidence} /></span>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink">{t.ai.reason}</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{t.ai.summary}</p>
            {needsConfirm && (
              <div className="mt-3 flex items-center gap-3 border-t border-orchid-200 pt-3">
                <p className="flex-1 text-[13px] text-orchid-700">The AI was not sure about this one. Is “{OWNER[t.responsibility].label}” right?</p>
                <Button size="sm" variant="ai" icon={Check} loading={busy === 'confirm'} onClick={confirm}>Yes, confirm</Button>
              </div>
            )}
          </section>
        )}

        <ThreadInsights thread={t} />

        <ol className="space-y-4">
          {t.messages.map((m) => (
            <li key={m.id} className={cx('rounded-xl border p-4', m.direction === 'out' ? 'border-cobalt-200 bg-cobalt-50/40' : 'border-line bg-white')}>
              <div className="flex items-center gap-3">
                <Avatar name={m.from.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.from.name}</p>
                  <p className="text-xs text-ink-mute">{shortTime(m.at)}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-6 text-ink-soft">{m.body}</p>
            </li>
          ))}
        </ol>

        {t.status === 'open' && <ReplyComposer thread={t} onSent={(expectReply) => !expectReply && onBack?.()} />}

        {t.activity?.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <History className="h-4 w-4" aria-hidden /> Activity
            </h3>
            <ul className="space-y-2 border-l border-line pl-4">
              {[...t.activity].reverse().map((a, i) => (
                <li key={i} className="text-[13px] leading-5 text-ink-soft">
                  <span className="font-medium text-ink">{a.actor}</span> {a.text}
                  <span className="ml-2 text-xs text-ink-faint">{shortTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}