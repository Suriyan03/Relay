import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { llmConfig } from '../ai/llm.js';
import { buildSeedThreads, mailboxFor } from '../seed/threads.js';
import { analyzeAndApply } from './pipeline.js';
import { addEvent } from './workspace.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROVIDERS = { gmail: 'Gmail', outlook: 'Outlook' };

const people = (ws) => ({
  client: { name: ws.clientName, first: ws.clientName.split(' ')[0] },
  assistant: { name: ws.assistantName, first: ws.assistantName.split(' ')[0] },
});

export async function createAccount(ws, provider, email) {
  const { client } = people(ws);
  const account = {
    _id: randomUUID(),
    workspaceId: ws._id,
    provider,
    email: email || mailboxFor(provider, client),
    status: 'syncing',
    stage: 'authorizing',
    progress: { done: 0, total: 0 },
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
    threadCount: 0,
    error: null,
  };
  await db.accounts.insert(account);
  runImport(account._id).catch(() => {});
  return account;
}

async function classifyAll(threads, accountId, startDone = 0) {
  const live = llmConfig().live;
  const concurrency = live ? 2 : 2;
  let done = startDone;
  let i = 0;
  const worker = async () => {
    while (i < threads.length) {
      const t = threads[i++];
      try {
        await analyzeAndApply(t._id, 'initial');
      } catch (e) {
        console.warn('[sync] classify failed', e.message);
      }
      done += 1;
      await db.accounts.patch(accountId, { progress: { done, total: threads.length + startDone } });
      if (!live) await sleep(190);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function runImport(accountId) {
  try {
    let account = await db.accounts.findOne({ _id: accountId });
    const ws = await db.workspaces.findOne({ _id: account.workspaceId });
    await sleep(900);
    await db.accounts.patch(accountId, { stage: 'fetching' });
    await sleep(1100);
    const { client, assistant } = people(ws);
    const threads = buildSeedThreads({ provider: account.provider, workspaceId: ws._id, accountId, client, assistant }).map(({ _expect, ...t }) => t);
    await db.threads.insertMany(threads);
    await db.accounts.patch(accountId, { stage: 'analyzing', progress: { done: 0, total: threads.length }, threadCount: threads.length });
    await classifyAll(threads, accountId);
    await db.accounts.patch(accountId, { status: 'connected', stage: 'done', lastSyncAt: new Date().toISOString() });
    await addEvent(ws._id, { type: 'sync', text: `${PROVIDERS[account.provider]} connected. ${threads.length} conversations imported and sorted.` });
  } catch (e) {
    console.error('[sync] import failed', e);
    await db.accounts.patch(accountId, { status: 'error', stage: 'error', error: e.message });
  }
}

/** Re-sync: simulated fetch plus classification of anything not yet analysed. */
export async function resync(accountId) {
  const account = await db.accounts.findOne({ _id: accountId });
  if (!account) return null;
  await db.accounts.patch(accountId, { status: 'syncing', stage: 'fetching', error: null });
  (async () => {
    try {
      await sleep(1400);
      const pending = (await db.threads.find({ accountId })).filter((t) => !t.ai);
      if (pending.length) {
        await db.accounts.patch(accountId, { stage: 'analyzing', progress: { done: 0, total: pending.length } });
        await classifyAll(pending, accountId);
      }
      const count = (await db.threads.find({ accountId })).length;
      await db.accounts.patch(accountId, { status: 'connected', stage: 'done', lastSyncAt: new Date().toISOString(), threadCount: count });
    } catch (e) {
      await db.accounts.patch(accountId, { status: 'error', stage: 'error', error: e.message });
    }
  })();
  return db.accounts.findOne({ _id: accountId });
}
