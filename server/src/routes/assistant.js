import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { db, storeKind } from '../db.js';
import { config } from '../config.js';
import { auth, wrap, HttpError } from '../lib/auth.js';
import { analyzeAndApply, pushActivity, LABEL } from '../services/pipeline.js';
import { createAccount, resync } from '../services/sync.js';
import { listScenarios, runScenario } from '../services/simulate.js';
import { addEvent, wipeWorkspaceData } from '../services/workspace.js';
import { draftReply } from '../ai/draft.js';
import { answer } from '../ai/chat.js';
import { llmStatus } from '../ai/llm.js';

const r = Router();
r.use(auth('assistant'));

async function getWs(req) {
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  if (!ws) throw new HttpError(401, 'Your workspace no longer exists. Please sign in again.');
  return ws;
}
const ctxOf = (ws) => ({ clientName: ws.clientName, assistantName: ws.assistantName, now: new Date() });
async function own(req, id) {
  const t = await db.threads.findOne({ _id: id });
  if (!t || t.workspaceId !== req.auth.wid) throw new HttpError(404, 'That conversation could not be found.');
  return t;
}
async function ownAccount(req, id) {
  const a = await db.accounts.findOne({ _id: id });
  if (!a || a.workspaceId !== req.auth.wid) throw new HttpError(404, 'That account could not be found.');
  return a;
}
const userName = async (req) => (await db.users.findOne({ _id: req.auth.uid }))?.name || 'Assistant';

/* ------------------------------ threads ------------------------------ */
r.get('/threads', wrap(async (req, res) => {
  res.json({ threads: await db.threads.find({ workspaceId: req.auth.wid }) });
}));

r.get('/threads/:id', wrap(async (req, res) => res.json({ thread: await own(req, req.params.id) })));

r.patch('/threads/:id', wrap(async (req, res) => {
  const t = await own(req, req.params.id);
  const b = req.body || {};
  const patch = {};
  const name = await userName(req);
  if (typeof b.important === 'boolean') {
    patch.important = b.important;
    patch.importantLocked = true;
  }
  if (typeof b.unread === 'boolean') patch.unread = b.unread;
  if (typeof b.reviewed === 'boolean') {
    patch.reviewed = b.reviewed;
    if (b.reviewed) patch.activity = pushActivity(t, name, 'Confirmed the AI classification.');
  }
  if (['open', 'archived', 'completed'].includes(b.status) && b.status !== t.status) {
    patch.status = b.status;
    const text = { archived: 'Archived this conversation.', completed: 'Marked this conversation as completed.', open: 'Reopened this conversation.' }[b.status];
    patch.activity = pushActivity(t, name, text);
    if (b.status === 'open' && t.clientAction?.type === 'handled') patch.clientAction = null;
  }
  if (b.draft === null) patch.draft = null;
  else if (b.draft && typeof b.draft.body === 'string') {
    patch.draft = { ...(t.draft || {}), body: b.draft.body, voice: b.draft.voice || t.draft?.voice || 'assistant', savedAt: new Date().toISOString(), source: t.draft?.source || 'manual' };
  }
  res.json({ thread: await db.threads.patch(t._id, patch) });
}));

r.post('/threads/:id/override', wrap(async (req, res) => {
  const t = await own(req, req.params.id);
  const resp = req.body.responsibility;
  const name = await userName(req);
  if (resp === 'auto') {
    const aiResp = t.ai?.responsibility || t.responsibility;
    const patch = {
      override: null,
      responsibility: aiResp,
      suggestion: null,
      needsReview: !!t.ai && t.ai.confidence < config.reviewThreshold,
      reviewed: false,
      tags: { ...t.tags, action: !!t.ai?.tags?.actionRequired && aiResp !== 'none' },
      activity: pushActivity(t, name, `Went back to the AI's choice: "${LABEL[aiResp]}".`),
    };
    return res.json({ thread: await db.threads.patch(t._id, patch) });
  }
  if (!['assistant', 'client', 'none'].includes(resp)) throw new HttpError(400, 'Choose assistant, client or none.');
  if (resp === t.responsibility && t.override) return res.json({ thread: t });
  const patch = {
    responsibility: resp,
    override: { by: name, at: new Date().toISOString(), from: t.responsibility },
    needsReview: false,
    reviewed: true,
    suggestion: null,
    changedFrom: null,
    tags: { ...t.tags, action: resp !== 'none' && !!(t.ai?.tags?.actionRequired || t.tags?.action) },
    activity: pushActivity(t, name, `Changed the reply owner from "${LABEL[t.responsibility]}" to "${LABEL[resp]}".`),
  };
  if (resp === 'client' && t.clientAction?.type) patch.clientAction = null;
  res.json({ thread: await db.threads.patch(t._id, patch) });
}));

r.post('/threads/:id/reclassify', wrap(async (req, res) => {
  const t = await own(req, req.params.id);
  const result = await analyzeAndApply(t._id, 'reclassify');
  res.json({ thread: result.thread });
}));

r.post('/threads/:id/draft', wrap(async (req, res) => {
  const t = await own(req, req.params.id);
  const ws = await getWs(req);
  const voice = req.body.voice === 'client' || req.body.voice === 'assistant' ? req.body.voice : t.responsibility === 'client' ? 'client' : 'assistant';
  const tone = ['professional', 'warm', 'brief'].includes(req.body.tone) ? req.body.tone : 'professional';
  const instruction = String(req.body.instruction || '').slice(0, 400);
  const out = await draftReply(t, ctxOf(ws), { tone, instruction, voice });
  const draft = { body: out.body, voice, tone, instruction, source: out.source, generatedAt: new Date().toISOString() };
  res.json({ thread: await db.threads.patch(t._id, { draft }) });
}));

r.post('/threads/:id/send', wrap(async (req, res) => {
  const t = await own(req, req.params.id);
  const ws = await getWs(req);
  const body = String(req.body.body || '').trim();
  if (body.length < 2) throw new HttpError(400, 'Write a reply before sending.');
  const voice = req.body.voice === 'client' ? 'client' : 'assistant';
  const expectReply = req.body.expectReply !== false;
  const acct = (await db.accounts.findOne({ _id: t.accountId })) || {};
  const lastIn = [...t.messages].reverse().find((m) => m.direction === 'in');
  const now = new Date().toISOString();
  const msg = {
    id: randomUUID(),
    from: { name: ws.clientName, email: acct.email || 'client@relay.demo' },
    to: lastIn?.from || t.counterpart,
    at: now,
    body,
    direction: 'out',
    sentBy: voice,
  };
  const name = await userName(req);
  const patch = {
    messages: [...t.messages, msg],
    lastMessageAt: now,
    responsibility: 'none',
    override: null,
    suggestion: null,
    needsReview: false,
    reviewed: true,
    unread: false,
    draft: null,
    changedFrom: null,
    tags: { action: false, waiting: expectReply, meeting: t.tags?.meeting || false },
    status: expectReply ? 'open' : 'completed',
    activity: pushActivity(t, name, `Approved and sent a reply${voice === 'client' ? ` as ${ws.clientName}` : ''}. ${expectReply ? 'Now waiting for a response.' : 'Marked as completed.'}`),
  };
  res.json({ thread: await db.threads.patch(t._id, patch) });
}));

/* ------------------------------ accounts ------------------------------ */
r.get('/accounts', wrap(async (req, res) => res.json({ accounts: await db.accounts.find({ workspaceId: req.auth.wid }) })));

r.post('/accounts/connect', wrap(async (req, res) => {
  const ws = await getWs(req);
  const provider = req.body.provider;
  if (!['gmail', 'outlook'].includes(provider)) throw new HttpError(400, 'Choose Gmail or Outlook.');
  const existing = (await db.accounts.find({ workspaceId: ws._id })).find((a) => a.provider === provider);
  if (existing) throw new HttpError(409, `${provider === 'gmail' ? 'Gmail' : 'Outlook'} is already connected.`);
  res.json({ account: await createAccount(ws, provider, req.body.email) });
}));

r.post('/accounts/:id/sync', wrap(async (req, res) => {
  const a = await ownAccount(req, req.params.id);
  if (a.status === 'needs_reauth') throw new HttpError(400, 'Reconnect this account before syncing.');
  res.json({ account: await resync(a._id) });
}));

// Demo: simulate an expired authorization so the error state can be shown.
r.post('/accounts/:id/expire', wrap(async (req, res) => {
  const a = await ownAccount(req, req.params.id);
  res.json({ account: await db.accounts.patch(a._id, { status: 'needs_reauth', stage: 'error', error: 'Access expired. Reconnect to keep syncing.' }) });
}));

r.post('/accounts/:id/reconnect', wrap(async (req, res) => {
  const a = await ownAccount(req, req.params.id);
  await db.accounts.patch(a._id, { status: 'syncing', stage: 'authorizing', error: null });
  res.json({ account: await resync(a._id) });
}));

r.delete('/accounts/:id', wrap(async (req, res) => {
  const a = await ownAccount(req, req.params.id);
  await db.threads.deleteWhere({ accountId: a._id });
  await db.accounts.deleteWhere({ _id: a._id });
  res.json({ ok: true });
}));

/* ------------------------------ events ------------------------------ */
r.get('/events', wrap(async (req, res) => {
  const user = await db.users.findOne({ _id: req.auth.uid });
  const all = (await db.events.find({ workspaceId: req.auth.wid })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
  const seen = user?.eventsSeenAt || '1970';
  res.json({ events: all, unread: all.filter((e) => e.at > seen).length });
}));
r.post('/events/seen', wrap(async (req, res) => {
  await db.users.patch(req.auth.uid, { eventsSeenAt: new Date().toISOString() });
  res.json({ ok: true });
}));

/* ------------------------------ AI + demo tools ------------------------------ */
r.get('/ai/status', (req, res) => res.json({ ...llmStatus(), store: storeKind, reviewThreshold: config.reviewThreshold }));

r.post('/chat', wrap(async (req, res) => {
  const ws = await getWs(req);
  const message = String(req.body.message || '').trim().slice(0, 600);
  if (!message) throw new HttpError(400, 'Ask a question first.');
  const threads = await db.threads.find({ workspaceId: ws._id });
  const thread = req.body.threadId ? threads.find((t) => t._id === req.body.threadId) : null;
  const out = await answer({ message, history: Array.isArray(req.body.history) ? req.body.history : [], thread, threads, ctx: ctxOf(ws) });
  res.json(out);
}));

r.get('/simulate/scenarios', wrap(async (req, res) => res.json({ scenarios: await listScenarios(req.auth.wid) })));
r.post('/simulate', wrap(async (req, res) => {
  const ws = await getWs(req);
  const out = await runScenario(ws, req.body.scenario);
  res.json({
    kind: out.kind,
    threadId: out.thread._id,
    subject: out.thread.subject,
    before: out.before,
    after: out.after,
    needsReview: out.thread.needsReview,
    suggestion: out.thread.suggestion,
  });
}));

r.post('/workspace/reset', wrap(async (req, res) => {
  await wipeWorkspaceData(req.auth.wid);
  res.json({ ok: true });
}));

r.post('/workspace/rotate-link', wrap(async (req, res) => {
  const inviteToken = randomBytes(12).toString('hex');
  await db.workspaces.patch(req.auth.wid, { inviteToken });
  res.json({ inviteToken });
}));

export default r;
