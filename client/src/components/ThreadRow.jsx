import { memo } from 'react';
import { Sparkles, Undo2, CheckCheck } from 'lucide-react';
import { OwnerBadge, ReviewBadge, TagChips, Chip, TONES, OWNER_TONE, ProviderTile } from './badges';
import { Avatar, cx } from './ui';
import { timeAgo, firstName } from '../lib/format';

function ThreadRowBase({ thread, selected, onClick, clientName }) {
  const t = thread;
  const last = t.messages[t.messages.length - 1];
  const sender = t.counterpart?.name || last.from.name;
  const tone = t.responsibility ? OWNER_TONE[t.responsibility] : 'slate';
  const recentlyChanged = t.changedAt && Date.now() - new Date(t.changedAt).getTime() < 15 * 60000;
  const sentLast = last.direction === 'out';

  if (t.classifying || !t.ai) {
    return (
      <div className="relative border-b border-line-soft px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 pl-12 text-xs text-orchid-600">
          <Sparkles className="h-3 w-3" aria-hidden /> AI is sorting this conversation
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      data-thread={t._id}
      className={cx(
        'group relative block w-full border-b border-line-soft px-4 py-3 text-left transition-colors',
        selected ? 'bg-slate-50' : 'hover:bg-slate-50/70',
        recentlyChanged && !selected && 'animate-settle',
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-[3px]', TONES[tone].spine, selected && 'w-1')} aria-hidden />
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5">
          <Avatar name={sender} size={36} />
          {t.unread && <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-cobalt-500" aria-label="Unread" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cx('truncate text-sm', t.unread ? 'font-semibold text-ink' : 'font-medium text-ink-soft')}>{sentLast ? `You to ${firstName(sender)}` : sender}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-mute">{timeAgo(t.lastMessageAt)}</span>
          </div>
          <p className={cx('truncate text-[13.5px] leading-5', t.unread ? 'font-medium text-ink' : 'text-ink-soft')}>{t.subject}</p>
          <p className="line-clamp-1 text-[13px] leading-5 text-ink-mute">{t.ai.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <OwnerBadge owner={t.responsibility} short />
            {t.needsReview && !t.reviewed && <ReviewBadge />}
            {recentlyChanged && t.changedFrom && (
              <Chip tone="orchid" icon={Sparkles} title="Reclassified after a new message">
                Was {t.changedFrom === 'none' ? 'no reply' : t.changedFrom}
              </Chip>
            )}
            {t.suggestion && (
              <Chip tone="orchid" icon={Sparkles}>
                AI suggests a change
              </Chip>
            )}
            {t.clientAction?.type === 'delegated' && t.responsibility === 'assistant' && (
              <Chip tone="marigold" icon={Undo2}>
                From {firstName(clientName)}
              </Chip>
            )}
            {t.clientAction?.type === 'handled' && t.status === 'completed' && (
              <Chip tone="slate" icon={CheckCheck}>
                Handled by {firstName(clientName)}
              </Chip>
            )}
            <TagChips thread={t} compact />
            <span className="ml-auto hidden text-xs text-ink-faint sm:inline">{t.category}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export const ThreadRow = memo(ThreadRowBase);

export function ThreadRowSkeletons({ n = 6 }) {
  return (
    <div aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-line-soft px-4 py-3.5">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
