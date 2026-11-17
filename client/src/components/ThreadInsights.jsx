import { CalendarClock, CalendarPlus, Lightbulb, Flag } from 'lucide-react';
import { Button } from './ui';
import { dayLabel, timeOnly, downloadIcs } from '../lib/format';

export function ThreadInsights({ thread: t }) {
  const points = t.ai?.keyPoints || [];
  const dates = (t.dates || []).filter((d) => d.iso && !Number.isNaN(Date.parse(d.iso)));
  const m = t.meeting?.startsAt ? t.meeting : null;
  if (!points.length && !dates.length && !m) return null;

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-4">
      {points.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Lightbulb className="h-4 w-4" aria-hidden /> Key points
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-soft marker:text-ink-faint">
            {points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {dates.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <Flag className="h-4 w-4" aria-hidden /> Dates and deadlines
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {dates.map((d, i) => (
              <li key={i} className="rounded-lg bg-marigold-50 px-2.5 py-1 text-[13px] text-marigold-700 ring-1 ring-inset ring-marigold-200">
                <span className="font-medium">{d.label}</span> · {dayLabel(d.iso)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {m && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-cobalt-50 p-3">
          <CalendarClock className="h-5 w-5 shrink-0 text-cobalt-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{m.title || t.subject}</p>
            <p className="text-[13px] text-ink-soft">
              {dayLabel(m.startsAt)}, {timeOnly(m.startsAt)}
              {m.location ? ` · ${m.location}` : ''}
            </p>
          </div>
          <Button size="sm" icon={CalendarPlus} onClick={() => downloadIcs({ ...m, title: m.title || t.subject }, t.subject)}>
            Add to calendar
          </Button>
        </div>
      )}
    </section>
  );
}