import { createApp } from '../index.js';

const app = await createApp();
const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

// auth
const demo = await api('POST', '/auth/demo');
check('demo login returns a token', !!demo.token);
const T = demo.token;
const me = await api('GET', '/auth/me', null, T);
check('me returns workspace + invite token', !!me.workspace?.inviteToken);
check('unauthenticated request rejected', (await api('GET', '/threads')).status === 401);
const signup = await api('POST', '/auth/signup', { name: 'Test User', email: 'T@x.com', password: 'secret1', clientName: 'Priya Sharma' });
check('signup works', !!signup.token);
check('duplicate signup rejected', (await api('POST', '/auth/signup', { name: 'Test User', email: 't@x.com', password: 'secret1' })).status === 409);
check('bad login rejected', (await api('POST', '/auth/login', { email: 't@x.com', password: 'nope' })).status === 401);
check('good login works', !!(await api('POST', '/auth/login', { email: 't@x.com', password: 'secret1' })).token);

// connect + sync
const acct = (await api('POST', '/accounts/connect', { provider: 'gmail' }, T)).account;
check('connect creates syncing account', acct?.status === 'syncing');
check('duplicate provider rejected', (await api('POST', '/accounts/connect', { provider: 'gmail' }, T)).status === 409);
let a;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  a = (await api('GET', '/accounts', null, T)).accounts[0];
  if (a.status !== 'syncing') break;
}
check('account finishes syncing', a.status === 'connected', `${a.progress.done}/${a.progress.total}`);
const out = await api('POST', '/accounts/connect', { provider: 'outlook' }, T);
for (let i = 0; i < 60; i++) {
  await sleep(250);
  a = (await api('GET', '/accounts', null, T)).accounts.find((x) => x._id === out.account._id);
  if (a.status !== 'syncing') break;
}
check('outlook connects too', a.status === 'connected');

let { threads } = await api('GET', '/threads', null, T);
check('29 threads imported', threads.length === 29, String(threads.length));
check('all classified', threads.every((t) => t.ai && t.responsibility));
const by = (r) => threads.filter((t) => t.responsibility === r).length;
console.log(`      assistant=${by('assistant')} client=${by('client')} none=${by('none')} review=${threads.filter((t) => t.needsReview).length}`);

// override
const design = threads.find((t) => t.key === 'design-sync');
let r = await api('POST', `/threads/${design._id}/override`, { responsibility: 'client' }, T);
check('manual override applies', r.thread.responsibility === 'client' && r.thread.override);
r = await api('POST', `/threads/${design._id}/override`, { responsibility: 'auto' }, T);
check('override can be reverted to AI', r.thread.responsibility === 'assistant' && !r.thread.override);

// patch
r = await api('PATCH', `/threads/${design._id}`, { important: true, unread: false }, T);
check('mark important/read', r.thread.important === true && r.thread.unread === false);
r = await api('PATCH', `/threads/${design._id}`, { status: 'archived' }, T);
check('archive', r.thread.status === 'archived');
r = await api('PATCH', `/threads/${design._id}`, { status: 'open' }, T);
check('reopen', r.thread.status === 'open');

// draft + send
r = await api('POST', `/threads/${design._id}/draft`, { tone: 'brief' }, T);
check('draft generated', r.thread.draft?.body?.length > 20, r.thread.draft?.source);
r = await api('POST', `/threads/${design._id}/send`, { body: r.thread.draft.body, expectReply: true }, T);
check('send moves thread to waiting', r.thread.responsibility === 'none' && r.thread.tags.waiting && r.thread.messages.at(-1).direction === 'out');
check('empty send rejected', (await api('POST', `/threads/${design._id}/send`, { body: '' }, T)).status === 400);

// client side
const link = await api('POST', '/auth/client-link', { inviteToken: me.workspace.inviteToken });
check('client magic link works', !!link.token);
check('bad client link rejected', (await api('POST', '/auth/client-link', { inviteToken: 'nope' })).status === 404);
const C = link.token;
check('client cannot use assistant API', (await api('GET', '/threads', null, C)).status === 403);
check('assistant cannot use client API', (await api('GET', '/client/overview', null, T)).status === 403);
let ov = await api('GET', '/client/overview', null, C);
check('client sees only client-to-reply items', ov.pending.length > 0 && ov.pending.every((p) => p.reason), `${ov.pending.length} pending`);
const first = ov.pending[0];
const second = ov.pending[1];
await api('POST', `/client/threads/${first.id}/handled`, {}, C);
await api('POST', `/client/threads/${second.id}/delegate`, { note: 'Please decline politely' }, C);
threads = (await api('GET', '/threads', null, T)).threads;
const h = threads.find((t) => t._id === first.id);
const d = threads.find((t) => t._id === second.id);
check('client "handled" reflected for assistant', h.status === 'completed' && h.clientAction.type === 'handled');
check('client "assistant take over" reflected', d.responsibility === 'assistant' && d.clientAction.type === 'delegated' && d.unread);
const ev = await api('GET', '/events', null, T);
check('assistant gets notified of client actions', ev.events.some((e) => e.type === 'client_handled') && ev.events.some((e) => e.type === 'client_delegated'), `unread=${ev.unread}`);
await api('POST', `/client/threads/${first.id}/undo`, {}, C);
await api('POST', `/client/threads/${second.id}/undo`, {}, C);
threads = (await api('GET', '/threads', null, T)).threads;
check('undo restores both', threads.find((t) => t._id === first.id).status === 'open' && threads.find((t) => t._id === second.id).responsibility === 'client');

// simulate (reclassification)
const fresh = await api('POST', '/auth/demo');
const F = fresh.token;
await api('POST', '/accounts/connect', { provider: 'gmail' }, F);
for (let i = 0; i < 60; i++) {
  await sleep(250);
  if ((await api('GET', '/accounts', null, F)).accounts[0].status === 'connected') break;
}
const sc = await api('GET', '/simulate/scenarios', null, F);
check('scenarios listed and available', sc.scenarios.every((s) => s.available));
const flip = await api('POST', '/simulate', { scenario: 'design-flip' }, F);
check('reply flips assistant -> client', flip.before === 'assistant' && flip.after === 'client', `${flip.before} -> ${flip.after}`);
const res = await api('POST', '/simulate', { scenario: 'press-resolved' }, F);
check('resolution flips assistant -> none', res.before === 'assistant' && res.after === 'none', `${res.before} -> ${res.after}`);
const trav = await api('POST', '/simulate', { scenario: 'travel-options' }, F);
check('waiting thread flips none -> assistant', trav.before === 'none' && trav.after === 'assistant', `${trav.before} -> ${trav.after}`);
for (const [id, want] of [['new-board', 'client'], ['new-courier', 'assistant'], ['new-newsletter', 'none']]) {
  const s = await api('POST', '/simulate', { scenario: id }, F);
  check(`new thread ${id} -> ${want}`, s.after === want, s.after);
}
const amb = await api('POST', '/simulate', { scenario: 'new-ambiguous' }, F);
check('ambiguous email flagged for review', amb.needsReview === true, `${amb.after} review=${amb.needsReview}`);

// override survives new messages, AI suggests instead
let ft = (await api('GET', '/threads', null, F)).threads;
const press = ft.find((t) => t.key === 'travel-quote');
await api('POST', `/threads/${press._id}/override`, { responsibility: 'client' }, F);
await api('POST', '/simulate', { scenario: 'travel-options' }, F);
ft = (await api('GET', '/threads', null, F)).threads;
const kept = ft.find((t) => t._id === press._id);
check('manual override kept, AI suggestion recorded', kept.responsibility === 'client' && kept.suggestion?.responsibility === 'assistant');

// chat
const chatQs = ['Which emails require the client\'s attention?', 'What am I waiting for a response on?', 'Show me emails that need my attention.', 'Any upcoming meetings?', 'Which need review?'];
for (const q of chatQs) {
  const c = await api('POST', '/chat', { message: q }, F);
  check(`chat: "${q}"`, c.answer && c.answer.length > 10, c.answer.split('\n')[0]);
}
const ctxThread = ft.find((t) => t.key === 'orbit-escalation');
for (const q of ['Summarize this conversation', 'Why has this email been assigned to the client?', 'Draft a reply to this conversation']) {
  const c = await api('POST', '/chat', { message: q, threadId: ctxThread._id }, F);
  check(`chat (thread): "${q}"`, c.answer && (q.startsWith('Draft') ? !!c.draft : true), c.answer.split('\n')[0].slice(0, 90));
}
check('empty chat rejected', (await api('POST', '/chat', { message: '' }, F)).status === 400);

// account lifecycle
const accs = (await api('GET', '/accounts', null, F)).accounts;
let x = await api('POST', `/accounts/${accs[0]._id}/expire`, {}, F);
check('simulate expired auth', x.account.status === 'needs_reauth');
check('sync blocked while expired', (await api('POST', `/accounts/${accs[0]._id}/sync`, {}, F)).status === 400);
await api('POST', `/accounts/${accs[0]._id}/reconnect`, {}, F);
await sleep(2200);
check('reconnect works', (await api('GET', '/accounts', null, F)).accounts[0].status === 'connected');
await api('DELETE', `/accounts/${accs[0]._id}`, null, F);
check('disconnect removes account and its mail', (await api('GET', '/threads', null, F)).threads.length === 0);

console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
server.close();
process.exit(failures ? 1 : 0);
