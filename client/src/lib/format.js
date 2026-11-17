const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function timeAgo(iso, now = Date.now()) {
  const d = now - new Date(iso).getTime();
  if (d < MIN) return 'Just now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`;
  if (d < 2 * DAY) return 'Yesterday';
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d ago`;
  const x = new Date(iso);
  return `${MONTHS[x.getMonth()]} ${x.getDate()}`;
}

export function shortTime(iso) {
  const x = new Date(iso);
  const now = new Date();
  const sameDay = x.toDateString() === now.toDateString();
  const t = x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return t;
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${t}`;
}

export function dayLabel(iso) {
  const x = new Date(iso);
  const now = new Date();
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(x) - start(now)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return x.toLocaleDateString([], { weekday: 'long' });
  return `${MONTHS[x.getMonth()]} ${x.getDate()}`;
}

export const timeOnly = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const firstName = (n = '') => n.trim().split(/\s+/)[0] || '';
export const initials = (n = '') =>
  n
    .replace(/<.*>/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const pct = (c) => `${Math.round((c || 0) * 100)}%`;

export function downloadIcs(meeting, subject) {
  if (!meeting?.startsAt) return;
  const start = new Date(meeting.startsAt);
  const end = new Date(start.getTime() + 3600000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => s.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Relay//EN', 'BEGIN:VEVENT', `UID:${f(start)}-${Math.random().toString(36).slice(2)}@relay`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${esc(meeting.title)}`, meeting.location ? `LOCATION:${esc(meeting.location)}` : null, `DESCRIPTION:${esc(`From email: ${subject}`)}`, 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.slice(0, 40).replace(/[^a-z0-9]+/gi, '-')}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
