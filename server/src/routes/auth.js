import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { auth, sign, wrap, HttpError } from '../lib/auth.js';
import { createWorkspace } from '../services/workspace.js';
import { llmStatus } from '../ai/llm.js';
import { storeKind } from '../db.js';

const r = Router();
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

function session(user, ws) {
  return {
    token: sign({ uid: user._id, wid: ws._id, role: 'assistant' }),
    user: { id: user._id, name: user.name, email: user.email, role: 'assistant' },
    workspace: { id: ws._id, clientName: ws.clientName },
  };
}

r.post('/signup', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const clientName = (req.body.clientName || '').trim() || 'Arjun Mehta';
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.');
  if (!emailOk(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 6) throw new HttpError(400, 'Use a password with at least 6 characters.');
  if (await db.users.findOne({ email })) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  const ws = await createWorkspace({ assistantName: name, clientName });
  const user = { _id: randomUUID(), email, name, passwordHash: bcrypt.hashSync(password, 8), role: 'assistant', workspaceId: ws._id, createdAt: new Date().toISOString(), eventsSeenAt: new Date().toISOString() };
  await db.users.insert(user);
  res.json(session(user, ws));
}));

r.post('/login', wrap(async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = await db.users.findOne({ email });
  if (!user || !bcrypt.compareSync(req.body.password || '', user.passwordHash)) throw new HttpError(401, 'Email or password is not correct.');
  const ws = await db.workspaces.findOne({ _id: user.workspaceId });
  res.json(session(user, ws));
}));

// One-click demo: every visitor gets their own isolated workspace.
r.post('/demo', wrap(async (req, res) => {
  const ws = await createWorkspace({ assistantName: 'Sana Kapoor', clientName: 'Arjun Mehta', demo: true });
  const user = { _id: randomUUID(), email: `demo-${randomBytes(4).toString('hex')}@relay.demo`, name: 'Sana Kapoor', passwordHash: bcrypt.hashSync(randomBytes(8).toString('hex'), 4), role: 'assistant', workspaceId: ws._id, createdAt: new Date().toISOString(), eventsSeenAt: new Date().toISOString() };
  await db.users.insert(user);
  res.json(session(user, ws));
}));

// Magic link for the client view (no password needed).
r.post('/client-link', wrap(async (req, res) => {
  const ws = await db.workspaces.findOne({ inviteToken: String(req.body.inviteToken || '') });
  if (!ws) throw new HttpError(404, 'This link is no longer valid. Ask your assistant for a new one.');
  res.json({
    token: sign({ uid: `client:${ws._id}`, wid: ws._id, role: 'client' }),
    user: { id: `client:${ws._id}`, name: ws.clientName, role: 'client' },
    workspace: { id: ws._id, clientName: ws.clientName, assistantName: ws.assistantName },
  });
}));

r.get('/me', auth(), wrap(async (req, res) => {
  const ws = await db.workspaces.findOne({ _id: req.auth.wid });
  if (!ws) throw new HttpError(401, 'Your workspace no longer exists. Please sign in again.');
  if (req.auth.role === 'client') {
    return res.json({ user: { id: req.auth.uid, name: ws.clientName, role: 'client' }, workspace: { id: ws._id, clientName: ws.clientName, assistantName: ws.assistantName } });
  }
  const user = await db.users.findOne({ _id: req.auth.uid });
  if (!user) throw new HttpError(401, 'Your account no longer exists. Please sign in again.');
  const accounts = await db.accounts.find({ workspaceId: ws._id });
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: 'assistant' },
    workspace: { id: ws._id, clientName: ws.clientName, assistantName: ws.assistantName, inviteToken: ws.inviteToken, demo: !!ws.demo },
    accountCount: accounts.length,
    ai: { ...llmStatus(), store: storeKind },
  });
}));

export default r;
