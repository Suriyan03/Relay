import { Bell, Mail, Sparkles, CircleHelp, CheckCheck, UserCog, Undo2 } from 'lucide-react';
import { useData } from '../context/Data.jsx';
import { IconButton, Popover, cx } from './ui.jsx';
import { timeAgo } from '../lib/format';

const KIND = {
  sync: { icon: Mail, tone: 'bg-cobalt-50 text-cobalt-600' },
  new_email: { icon: Mail, tone: 'bg-cobalt-50 text-cobalt-600' },
  reclassified: { icon: Sparkles, tone: 'bg-orchid-50 text-orchid-600' },
  needs_review: { icon: CircleHelp, tone: 'bg-orchid-50 text-orchid-600' },
  client_handled: { icon: CheckCheck, tone: 'bg-emerald-50 text-emerald-600' },
  client_delegated: { icon: UserCog, tone: 'bg-marigold-50 text-marigold-700' },
  client_undo: { icon: Undo2, tone: 'bg-slate-100 text-slate-600' },
};
const FALLBACK = { icon: Bell, tone: 'bg-slate-100 text-slate-600' };

export function Notifications({ onOpenThread }) {
  const { events, markEventsSeen } = useData();

  return (
    <Popover
      width="w-[24rem]"
      onOpenChange={(open) => {
        if (!open) markEventsSeen();
      }}
      trigger={({ toggle }) => (
        <span className="relative inline-flex">
          <IconButton icon={Bell} label="Notifications" onClick={toggle} />
          {events.unread > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {events.unread > 9 ? '9+' : events.unread}
            </span>
          )}
        </span>
      )}
    >
      {({ close }) => (
        <div>
          <div className="border-b border-line-soft px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>
          <div className="scroll-thin max-h-[26rem] overflow-y-auto">
            {events.list.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-mute">Nothing yet. Updates about your inbox will show up here.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {events.list.map((e, i) => {
                  const k = KIND[e.type] || FALLBACK;
                  const Icon = k.icon;
                  const isNew = i < events.unread;
                  return (
                    <li key={e._id ?? e.id ?? i}>
                      <button
                        disabled={!e.threadId}
                        onClick={() => {
                          onOpenThread?.(e.threadId);
                          close();
                        }}
                        className={cx('flex w-full items-start gap-3 px-4 py-3 text-left', e.threadId && 'hover:bg-slate-50', isNew && 'bg-cobalt-50/40')}
                      >
                        <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', k.tone)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] leading-5 text-ink">{e.text}</span>
                          <span className="mt-0.5 block text-xs text-ink-mute">{timeAgo(e.at)}</span>
                        </span>
                        {isNew && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cobalt-500" aria-label="New" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}