import { Router } from 'express';
import { db } from '../db.js';
import { auth, wrap, HttpError } from '../lib/auth.js';
import { pushActivity } from '../services/pipeline.js';
import { addEvent } from '../services/workspace.js';
import { SEGMENTS } from '../lib/segments.js';

const r = Router();
r.use(auth('client'));

const WEEK = 7 * 86400000;

const cardOf = (t) => ({
  id: t._id,
  subject: t.subject,
  counterpart: t.counterpart,
  lastMessageAt: t.lastMessageAt,
  summary: t.ai?.summary || '',
  reason: t.ai?.reason || '',
  important: !!t.important,
  category: t.category,
  deadline: (t.dates || []).find((d) => d.label === 'Deadline') || null,
  messages: t.messages.map((m) => ({ id: m.id, from: m.from, at: m.at, body: m.body, direction: m.direction, sentBy: m.sentBy })),
});

async function ownThread(req, id) {
  const t = await db.threads.findOne({ _id: id });
  if (!t || t.workspaceId !== req.auth.wid) throw new HttpError(404, 'That conversation could not be found.');
  return t;
}

r.get('/overview', wrap(async (req, res) => {
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  if (!ws) throw new HttpError(401, 'This workspace no longer exists.');
  const threads = await db.threads.find({ workspaceId: ws._id });
  const pending = threads
    .filter(SEGMENTS.client)
    .sort((a, b) => Number(b.important) - Number(a.important) || b.lastMessageAt.localeCompare(a.lastMessageAt));
  const recent = threads
    .filter((t) => t.clientAction && ['handled', 'delegated'].includes(t.clientAction.type) && Date.now() - new Date(t.clientAction.at).getTime() < WEEK)
    .sort((a, b) => b.clientAction.at.localeCompare(a.clientAction.at))
    .slice(0, 6)
    .map((t) => ({ id: t._id, subject: t.subject, counterpart: t.counterpart, type: t.clientAction.type, at: t.clientAction.at }));
  res.json({
    clientName: ws.clientName,
    assistantName: ws.assistantName,
    pending: pending.map(cardOf),
    recent,
    assistantCount: threads.filter(SEGMENTS.assistant).length,
    connected: (await db.accounts.find({ workspaceId: ws._id })).some((a) => a.status === 'connected'),
  });
}));

r.post('/threads/:id/handled', wrap(async (req, res) => {
  const t = await ownThread(req, req.params.id);
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  await db.threads.patch(t._id, {
    status: 'completed',
    unread: false,
    clientAction: { type: 'handled', at: new Date().toISOString(), note: null },
    activity: pushActivity(t, ws.clientName, `${ws.clientName} marked this as handled.`),
  });
  await addEvent(ws._id, { type: 'client_handled', threadId: t._id, text: `${ws.clientName} marked "${t.subject}" as handled.`, actor: ws.clientName });
  res.json({ ok: true });
}));

r.post('/threads/:id/delegate', wrap(async (req, res) => {
  const t = await ownThread(req, req.params.id);
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  const note = String(req.body.note || '').trim().slice(0, 300) || null;
  const at = new Date().toISOString();
  await db.threads.patch(t._id, {
    responsibility: 'assistant',
    override: { by: `${ws.clientName} (client)`, at, from: 'client' },
    needsReview: false,
    reviewed: true,
    suggestion: null,
    unread: true,
    tags: { ...t.tags, action: true },
    clientAction: { type: 'delegated', at, note },
    activity: pushActivity(t, ws.clientName, `${ws.clientName} asked ${ws.assistantName.split(' ')[0]} to take over this conversation.${note ? ` Note: "${note}"` : ''}`),
  });
  await addEvent(ws._id, { type: 'client_delegated', threadId: t._id, text: `${ws.clientName} asked you to take over "${t.subject}".${note ? ` "${note}"` : ''}`, actor: ws.clientName });
  res.json({ ok: true });
}));

r.post('/threads/:id/undo', wrap(async (req, res) => {
  const t = await ownThread(req, req.params.id);
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  const action = t.clientAction;
  if (!action) return res.json({ ok: true });
  const patch = { clientAction: null };
  if (action.type === 'handled') patch.status = 'open';
  if (action.type === 'delegated') {
    patch.responsibility = 'client';
    patch.override = null;
    patch.reviewed = false;
    patch.tags = { ...t.tags, action: !!t.ai?.tags?.actionRequired };
  }
  patch.activity = pushActivity(t, ws.clientName, `${ws.clientName} undid the previous action.`);
  await db.threads.patch(t._id, patch);
  await addEvent(ws._id, { type: 'client_undo', threadId: t._id, text: `${ws.clientName} undid their action on "${t.subject}".`, actor: ws.clientName });
  res.json({ ok: true });
}));

export default r;
