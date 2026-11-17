import { useMemo } from 'react';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { dayLabel, timeOnly, downloadIcs } from '../lib/format';

export function UpcomingMeetings({ threads, onOpen }) {
  const items = useMemo(
    () =>
      threads
        .filter((t) => t.status !== 'archived' && t.meeting?.startsAt && new Date(t.meeting.startsAt) > new Date())
        .sort((a, b) => String(a.meeting.startsAt).localeCompare(String(b.meeting.startsAt)))
        .slice(0, 6),
    [threads],
  );
  if (!items.length) return null;

  return (
    <div className="mt-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Upcoming, found in email
      </p>
      <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((t) => (
          <li key={t._id} className="w-64 shrink-0 rounded-xl border border-line bg-white p-3">
            <button onClick={() => onOpen(t._id)} className="block w-full text-left">
              <p className="text-xs font-medium text-cobalt-600">
                {dayLabel(t.meeting.startsAt)} · {timeOnly(t.meeting.startsAt)}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold">{t.meeting.title || t.subject}</p>
              {t.meeting.location && <p className="truncate text-xs text-ink-mute">{t.meeting.location}</p>}
            </button>
            <button
              onClick={() => downloadIcs({ ...t.meeting, title: t.meeting.title || t.subject }, t.subject)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:underline"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Add to calendar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}