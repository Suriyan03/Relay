import { Star, ListChecks, Hourglass, CalendarClock, CircleHelp, Sparkles } from 'lucide-react';
import { OWNER } from '../lib/segments';
import { cx } from './ui';

export const TONES = {
  cobalt: { chip: 'bg-cobalt-50 text-cobalt-700 ring-cobalt-200', dot: 'bg-cobalt-500', spine: 'bg-cobalt-500', soft: 'bg-cobalt-50', border: 'border-cobalt-200', text: 'text-cobalt-700', solid: 'bg-cobalt-600 text-white' },
  marigold: { chip: 'bg-marigold-50 text-marigold-700 ring-marigold-200', dot: 'bg-marigold-400', spine: 'bg-marigold-400', soft: 'bg-marigold-50', border: 'border-marigold-200', text: 'text-marigold-700', solid: 'bg-marigold-400 text-ink' },
  slate: { chip: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', spine: 'bg-slate-300', soft: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', solid: 'bg-slate-600 text-white' },
  orchid: { chip: 'bg-orchid-50 text-orchid-700 ring-orchid-200', dot: 'bg-orchid-500', spine: 'bg-orchid-500', soft: 'bg-orchid-50', border: 'border-orchid-200', text: 'text-orchid-700', solid: 'bg-orchid-600 text-white' },
};
export const OWNER_TONE = { assistant: 'cobalt', client: 'marigold', none: 'slate' };

export function Chip({ tone = 'slate', icon: Icon, children, className, title }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone].chip, className)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function OwnerBadge({ owner, short, className, confidence }) {
  if (!owner) return null;
  const o = OWNER[owner];
  return (
    <Chip tone={OWNER_TONE[owner]} icon={o.icon} className={className}>
      {short ? o.short : o.label}
      {confidence != null && <span className="font-normal opacity-70">{Math.round(confidence * 100)}%</span>}
    </Chip>
  );
}

export const ReviewBadge = () => (
  <Chip tone="orchid" icon={CircleHelp} title="The AI was not confident. Confirm or change the reply owner.">
    Needs review
  </Chip>
);

export function TagChips({ thread, compact }) {
  const t = thread.tags || {};
  return (
    <>
      {thread.important && <Chip tone="marigold" icon={Star}>{compact ? '' : 'Important'}</Chip>}
      {t.action && <Chip icon={ListChecks}>Action</Chip>}
      {t.waiting && <Chip icon={Hourglass}>Waiting</Chip>}
      {(t.meeting || thread.meeting) && <Chip icon={CalendarClock}>Meeting</Chip>}
    </>
  );
}

export function ConfidenceMeter({ value }) {
  const v = Math.round((value || 0) * 100);
  const tone = v >= 85 ? 'bg-emerald-500' : v >= 70 ? 'bg-cobalt-500' : 'bg-orchid-500';
  return (
    <span className="inline-flex items-center gap-2" title={`AI confidence ${v}%`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <span className={cx('block h-full rounded-full', tone)} style={{ width: `${v}%` }} />
      </span>
      <span className="text-xs tabular-nums text-ink-mute">{v}% sure</span>
    </span>
  );
}

export const AiMark = ({ className }) => <Sparkles className={cx('h-3.5 w-3.5 text-orchid-500', className)} aria-hidden />;

export function ProviderTile({ provider, size = 40 }) {
  const g = provider === 'gmail';
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-xl text-white', g ? 'bg-[#D93025]' : 'bg-[#0A64C8]')}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {g ? (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 6.5 8.5 7 8.5-7" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="12" cy="12" r="3.2" />
          </>
        )}
      </svg>
    </span>
  );
}
export const providerName = (p) => (p === 'gmail' ? 'Gmail' : 'Outlook');

export function Logo({ size = 28, text = true, inverse }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={inverse ? '#FFFFFF' : '#0E1A2B'} />
        <circle cx="12" cy="16" r="7" fill="#2F5BEA" />
        <circle cx="20" cy="16" r="7" fill="#F5B800" fillOpacity=".92" />
      </svg>
      {text && <span className={cx('font-display text-[21px] font-semibold tracking-tight', inverse ? 'text-white' : 'text-ink')}>Relay</span>}
    </span>
  );
}
