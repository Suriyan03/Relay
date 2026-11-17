import { Inbox, Mail, UserCog, UserRound, BellOff, CircleHelp, ListChecks, Hourglass, CalendarClock, Star, Newspaper, CheckCheck, Archive } from 'lucide-react';

// Mirrors server/src/lib/segments.js
const open = (t) => t.status === 'open';
export const FILTERS = {
  inbox: (t) => t.status !== 'archived',
  unread: (t) => t.status !== 'archived' && !!t.unread,
  assistant: (t) => open(t) && t.responsibility === 'assistant',
  client: (t) => open(t) && t.responsibility === 'client',
  none: (t) => open(t) && t.responsibility === 'none',
  review: (t) => open(t) && t.needsReview && !t.reviewed,
  action: (t) => open(t) && t.tags?.action,
  waiting: (t) => open(t) && t.tags?.waiting,
  meetings: (t) => t.status !== 'archived' && (t.tags?.meeting || !!t.meeting),
  important: (t) => t.status !== 'archived' && t.important,
  general: (t) => open(t) && t.responsibility === 'none' && !t.tags?.waiting && !t.tags?.meeting,
  completed: (t) => t.status === 'completed',
  archived: (t) => t.status === 'archived',
};

export const SEGMENTS = [
  { id: 'inbox', label: 'All conversations', short: 'All', icon: Inbox, group: 'main', empty: 'No conversations yet. Connect an account to start.' },
  { id: 'unread', label: 'Unread', short: 'Unread', icon: Mail, group: 'main', empty: 'You are all caught up.' },
  { id: 'assistant', label: 'Assistant to reply', short: 'Assistant', icon: UserCog, group: 'owner', tone: 'cobalt', empty: 'Nothing for you to reply to. Nice work.' },
  { id: 'client', label: 'Client to reply', short: 'Client', icon: UserRound, group: 'owner', tone: 'marigold', empty: 'Nothing is waiting on the client.' },
  { id: 'none', label: 'No reply needed', short: 'No reply', icon: BellOff, group: 'owner', tone: 'slate', empty: 'No informational conversations here.' },
  { id: 'review', label: 'Needs review', short: 'Review', icon: CircleHelp, group: 'owner', tone: 'orchid', empty: 'The AI is confident about everything right now.' },
  { id: 'action', label: 'Action required', short: 'Action', icon: ListChecks, group: 'organize', empty: 'No follow-up actions pending.' },
  { id: 'waiting', label: 'Waiting for response', short: 'Waiting', icon: Hourglass, group: 'organize', empty: 'Nothing is waiting on someone else.' },
  { id: 'meetings', label: 'Meetings and appointments', short: 'Meetings', icon: CalendarClock, group: 'organize', empty: 'No meetings or bookings found in email.' },
  { id: 'important', label: 'Important', short: 'Important', icon: Star, group: 'organize', empty: 'Nothing is marked important.' },
  { id: 'general', label: 'General', short: 'General', icon: Newspaper, group: 'organize', empty: 'No general updates.' },
  { id: 'completed', label: 'Completed', short: 'Done', icon: CheckCheck, group: 'done', empty: 'Completed conversations will show up here.' },
  { id: 'archived', label: 'Archived', short: 'Archived', icon: Archive, group: 'done', empty: 'Archived conversations will show up here.' },
];
export const SEGMENT = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

export const OWNER = {
  assistant: { label: 'Assistant to reply', short: 'Assistant', icon: UserCog },
  client: { label: 'Client to reply', short: 'Client', icon: UserRound },
  none: { label: 'No reply needed', short: 'No reply', icon: BellOff },
};

export const sortByRecent = (a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt);

/** Highest-signal first: unread + important + soon due, then recency. */
export function priority(t) {
  let s = 0;
  if (t.important) s += 3;
  if (t.unread) s += 1;
  const d = (t.dates || []).find((x) => x.label === 'Deadline' && x.iso);
  if (d) {
    const days = (new Date(d.iso) - Date.now()) / 86400000;
    if (days < 3) s += 2;
  }
  return s;
}