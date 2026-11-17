// Segment membership. Mirrored in client/src/lib/segments.js.
export const isOpen = (t) => t.status === 'open';

export const SEGMENTS = {
  inbox: (t) => t.status !== 'archived',
  assistant: (t) => isOpen(t) && t.responsibility === 'assistant',
  client: (t) => isOpen(t) && t.responsibility === 'client',
  none: (t) => isOpen(t) && t.responsibility === 'none',
  review: (t) => isOpen(t) && t.needsReview && !t.reviewed,
  action: (t) => isOpen(t) && t.tags?.action,
  waiting: (t) => isOpen(t) && t.tags?.waiting,
  meetings: (t) => t.status !== 'archived' && (t.tags?.meeting || !!t.meeting),
  important: (t) => t.status !== 'archived' && t.important,
  general: (t) => isOpen(t) && t.responsibility === 'none' && !t.tags?.waiting && !t.tags?.meeting,
  completed: (t) => t.status === 'completed',
  archived: (t) => t.status === 'archived',
};
