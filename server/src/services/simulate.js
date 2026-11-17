import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { blankThread, render } from '../seed/threads.js';
import { analyzeAndApply, pushActivity } from './pipeline.js';
import { addEvent } from './workspace.js';
import { HttpError } from '../lib/auth.js';

/**
 * "Simulate incoming email" scenarios. Each one either adds a new message to an
 * existing conversation (forcing reclassification) or creates a brand new thread.
 */
export const SCENARIOS = [
  {
    id: 'design-flip',
    kind: 'reply',
    targetKey: 'design-sync',
    title: 'Reply changes who should answer',
    description: 'Dev adds a ₹6L contract renewal that needs the client in the room. Assistant to reply becomes Client to reply.',
    body: `Actually, before we move it: the design tool contract (₹6L a year) is up for renewal and needs {cf}'s sign-off at that meeting.\n\nCan {cf} confirm they will attend personally and approve the renewal?\n\nDev`,
  },
  {
    id: 'press-resolved',
    kind: 'reply',
    targetKey: 'press-ledger',
    title: 'Conversation gets resolved',
    description: 'The journalist accepts the proposed slot. The thread drops to No reply needed.',
    body: `Thanks {a}, {w+2} at 4:00 PM works perfectly. Invite received, all set on our side!\n\nTanvi`,
  },
  {
    id: 'travel-options',
    kind: 'reply',
    targetKey: 'travel-quote',
    title: 'A waiting thread gets a response',
    description: 'The travel agent replies with fares. Waiting for response becomes Assistant to reply.',
    body: `Hi {a},\n\nPlease find three business-class options attached. SQ 505 at 8:05 AM is the best fit for your timings.\n\nCould you confirm which one to hold by {w+1}? Fares are valid for 24 hours only.\n\nSkyline Travels`,
  },
  {
    id: 'new-board',
    kind: 'new',
    title: 'New email: board member wants the client’s view',
    description: 'A fresh thread that should be classified as Client to reply.',
    counterpart: { name: 'Prof. S. Iyengar', email: 's.iyengar@northwindlabs.io' },
    subject: 'Q4 board agenda – your position on the ESOP pool expansion',
    body: `Hi {cf},\n\nI'm finalising the Q4 board agenda. Several directors want to know your position on expanding the ESOP pool by 2% before we meet.\n\nCould you share your thoughts by {w+2}? I'd prefer to hear it from you directly.\n\nProf. Iyengar`,
  },
  {
    id: 'new-courier',
    kind: 'new',
    title: 'New email: courier needs an address',
    description: 'Routine logistics, should land with the assistant.',
    counterpart: { name: 'BlueDart Express', email: 'support@bluedartexpress.in' },
    subject: 'Delivery attempt failed – please confirm address',
    body: `Hello,\n\nWe couldn't deliver your package (AWB 8821734) today. Please reply with a confirmed address and a preferred delivery slot for tomorrow.\n\nBlueDart Express`,
  },
  {
    id: 'new-newsletter',
    kind: 'new',
    title: 'New email: newsletter',
    description: 'Should be filed as No reply needed without bothering anyone.',
    counterpart: { name: 'Morning Brew', email: 'newsletter@morningbrew.com' },
    subject: 'Tech Daily: five stories you missed',
    body: `Good morning!\n\n1. Chipmakers report record quarterly demand\n2. A new open-source model tops coding benchmarks\n3. Startups rethink hybrid work\n\nYou are receiving this because you subscribed. Unsubscribe anytime.`,
  },
  {
    id: 'new-ambiguous',
    kind: 'new',
    title: 'New email: unclear request',
    description: 'The AI should not guess, it should flag this for review.',
    counterpart: { name: 'Rahul K', email: 'rahul.k@gmail.com' },
    subject: 'Quick question',
    body: `Hey {cf},\n\nDo you have a minute for a quick chat this week? Won't take long.\n\nRahul`,
  },
];

export async function listScenarios(workspaceId) {
  const threads = await db.threads.find({ workspaceId });
  const accounts = await db.accounts.find({ workspaceId });
  const hasAccount = accounts.some((a) => a.status === 'connected');
  return SCENARIOS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    kind: s.kind,
    available: hasAccount && (s.kind === 'new' || threads.some((t) => t.key === s.targetKey && t.status !== 'archived')),
  }));
}

export async function runScenario(ws, scenarioId) {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) throw new HttpError(404, 'Unknown scenario.');
  const ctx = {
    client: { name: ws.clientName, first: ws.clientName.split(' ')[0] },
    assistant: { name: ws.assistantName, first: ws.assistantName.split(' ')[0] },
    now: new Date(),
  };
  const accounts = (await db.accounts.find({ workspaceId: ws._id })).filter((a) => a.status === 'connected');
  if (!accounts.length) throw new HttpError(400, 'Connect an email account first.');
  const now = new Date().toISOString();

  if (s.kind === 'reply') {
    const thread = (await db.threads.find({ workspaceId: ws._id })).find((t) => t.key === s.targetKey);
    if (!thread) throw new HttpError(400, 'The conversation for this scenario is not in your inbox.');
    const acct = accounts.find((a) => a._id === thread.accountId) || accounts[0];
    const message = {
      id: randomUUID(),
      from: thread.counterpart,
      to: { name: ws.clientName, email: acct.email },
      at: now,
      body: render(s.body, ctx),
      direction: 'in',
      sentBy: null,
    };
    const patch = {
      messages: [...thread.messages, message],
      lastMessageAt: now,
      unread: true,
      status: 'open',
      draft: null,
      activity: pushActivity(thread, 'Relay', `New message from ${thread.counterpart.name}.`),
    };
    await db.threads.patch(thread._id, patch);
    await addEvent(ws._id, { type: 'new_email', threadId: thread._id, text: `New reply from ${thread.counterpart.name} on "${thread.subject}".`, actor: thread.counterpart.name });
    const result = await analyzeAndApply(thread._id, 'new_message');
    return { kind: 'reply', ...result };
  }

  const acct = accounts.find((a) => a.provider === 'gmail') || accounts[0];
  const message = {
    id: randomUUID(),
    from: s.counterpart,
    to: { name: ws.clientName, email: acct.email },
    at: now,
    body: render(s.body, ctx),
    direction: 'in',
    sentBy: null,
  };
  const thread = blankThread({
    workspaceId: ws._id,
    accountId: acct._id,
    provider: acct.provider,
    subject: render(s.subject, ctx),
    counterpart: s.counterpart,
    messages: [message],
    unread: true,
    importLabel: 'Received just now',
  });
  await db.threads.insert(thread);
  await addEvent(ws._id, { type: 'new_email', threadId: thread._id, text: `New email from ${s.counterpart.name}: "${thread.subject}".`, actor: s.counterpart.name });
  const result = await analyzeAndApply(thread._id, 'initial');
  const final = result.thread;
  if (final.needsReview) {
    await addEvent(ws._id, { type: 'needs_review', threadId: thread._id, text: `"${thread.subject}" needs your review, the AI is unsure who should reply.`, actor: 'AI' });
  }
  return { kind: 'new', ...result, before: null };
}
