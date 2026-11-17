import { completeJSON, llmConfig } from './llm.js';
import { renderThread } from './classify.js';
import { SEGMENTS } from '../lib/segments.js';
import { fallbackDraft } from './draft.js';
import { fmtDayMD } from '../lib/time.js';

const LABEL = { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed' };
const ago = (iso, now) => {
  const h = Math.max(0, (now - new Date(iso)) / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
};
const sender = (t) => (t.counterpart?.name || t.messages[0].from.name);

function digest(threads, now) {
  return threads
    .filter((t) => t.status !== 'archived')
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    .slice(0, 60)
    .map((t, i) => {
      const flags = [t.status !== 'open' ? t.status : null, t.unread ? 'unread' : null, t.important ? 'important' : null, t.tags?.action ? 'action' : null, t.tags?.waiting ? 'waiting' : null, t.tags?.meeting ? 'meeting' : null, t.needsReview && !t.reviewed ? 'needs-review' : null].filter(Boolean).join(',');
      return `T${i + 1} | ${t.subject} | from ${sender(t)} | ${ago(t.lastMessageAt, now)} | ${LABEL[t.responsibility] || 'unclassified'}${t.ai ? ` (${Math.round(t.ai.confidence * 100)}%)` : ''} | ${flags || '-'} | ${t.ai?.summary || ''} | why: ${t.ai?.reason || ''}`;
    });
}

export async function answer({ message, history = [], thread, threads, ctx }) {
  const now = ctx.now || new Date();
  if (llmConfig().live) {
    try {
      const rows = digest(threads, now);
      const idMap = Object.fromEntries(
        threads.filter((t) => t.status !== 'archived').sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).slice(0, 60).map((t, i) => [`T${i + 1}`, t._id]),
      );
      const raw = await completeJSON({
        system: `You are Relay's AI assistant, helping ${ctx.assistantName} (a personal assistant) manage ${ctx.clientName}'s email. Answer ONLY from the inbox data given. If the data does not contain the answer, say so. "Client" means ${ctx.clientName}. Be brief and concrete (under 120 words), plain text, no markdown headings. When listing emails, name them by subject and sender. If the user asks for a reply draft and a focused conversation is provided, put the full email body in "draft" (written as ${ctx.assistantName} on behalf of ${ctx.clientName}, ending with a sign-off) and keep "answer" to one sentence. Return JSON: {"answer": string, "threadIds": string[] (the T-numbers you referred to, max 8), "draft": string | null}. Today is ${fmtDayMD(now)}.`,
        user: `INBOX (id | subject | sender | age | reply owner | flags | summary | why)\n${rows.join('\n')}\n\n${thread ? `FOCUSED CONVERSATION (user is looking at this one)\n${renderThread(thread, ctx)}\n\n` : ''}${history.slice(-6).map((h) => `${h.role.toUpperCase()}: ${h.text}`).join('\n')}\nUSER: ${message}`,
        maxTokens: 700,
        temperature: 0.3,
      });
      return {
        answer: String(raw.answer || '').trim() || 'I could not find an answer in your inbox.',
        threadIds: (raw.threadIds || []).map((k) => idMap[k]).filter(Boolean),
        draft: raw.draft ? String(raw.draft).trim() : null,
        source: 'llm',
      };
    } catch (err) {
      console.warn(`[ai] chat failed, using rules: ${err.message}`);
    }
  }
  return { ...fallbackAnswer({ message, thread, threads, ctx, now }), source: 'rules' };
}

function list(arr, intro, empty) {
  if (!arr.length) return { answer: empty, threadIds: [] };
  const top = arr.slice(0, 8);
  return {
    answer: `${intro}\n${top.map((t) => `• ${t.subject} (${sender(t)})`).join('\n')}${arr.length > top.length ? `\n…and ${arr.length - top.length} more.` : ''}`,
    threadIds: top.map((t) => t._id),
  };
}

function fallbackAnswer({ message, thread, threads, ctx, now }) {
  const m = message.toLowerCase();
  const by = (seg) => threads.filter(SEGMENTS[seg]).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const client = ctx.clientName.split(' ')[0];

  if (thread && /summar|recap|tl;?dr|catch me up/.test(m)) {
    const a = thread.ai;
    return {
      answer: `${a?.summary || 'No summary yet.'}${a?.keyPoints?.length ? `\n\nKey points:\n${a.keyPoints.map((k) => `• ${k}`).join('\n')}` : ''}`,
      threadIds: [thread._id],
    };
  }
  if (thread && /\bwhy\b|assigned|who should|reason/.test(m)) {
    const a = thread.ai;
    const over = thread.override ? ` A manual override is in place (set by ${thread.override.by}).` : '';
    return {
      answer: `Reply owner: ${LABEL[thread.responsibility]}. ${a?.reason || ''} AI confidence: ${a ? Math.round(a.confidence * 100) : '–'}%.${over}`,
      threadIds: [thread._id],
    };
  }
  if (thread && /draft|write (a )?reply|reply to this|respond/.test(m)) {
    const voice = thread.responsibility === 'client' ? 'client' : 'assistant';
    return {
      answer: `Here is a draft for "${thread.subject}". Review it before sending.`,
      threadIds: [thread._id],
      draft: fallbackDraft(thread, ctx, { voice, instruction: message }),
    };
  }
  if (/client('s)? (attention|to reply)|need.*client|waiting on (the )?client|waiting on (him|her)|ask(ing)? (the )?client|which emails require/.test(m) || new RegExp(`waiting on ${client.toLowerCase()}`).test(m))
    return list(by('client'), `${client} needs to reply personally to ${by('client').length}:`, `Nothing needs ${client}'s personal reply right now.`);
  if (/waiting|pending (response|reply)|follow.?up|haven'?t heard|hear back/.test(m))
    return list(by('waiting'), `You are waiting on a response for ${by('waiting').length}:`, 'Nothing is waiting on a response right now.');
  if (/meeting|appointment|calendar|upcoming|schedule/.test(m)) {
    const mt = threads.filter((t) => t.meeting?.startsAt && new Date(t.meeting.startsAt) > now && t.status !== 'archived').sort((a, b) => a.meeting.startsAt.localeCompare(b.meeting.startsAt));
    return list(mt, 'Upcoming meetings and appointments from email:', 'No upcoming meetings found in email.');
  }
  if (/important|urgent|deadline|due\b/.test(m)) return list(by('important'), 'Marked important:', 'Nothing is marked important.');
  if (/review|not sure|unsure|low confidence|uncertain/.test(m)) return list(by('review'), 'The AI was not confident about these, so they need your review:', 'Nothing is flagged for review.');
  if (/unread/.test(m)) return list(threads.filter((t) => t.unread && t.status !== 'archived'), 'Unread conversations:', 'You are all caught up.');
  if (/need my attention|my attention|assistant to reply|what should i|to reply|action|todo|to do/.test(m)) {
    const mine = [...by('assistant'), ...by('review').filter((t) => t.responsibility !== 'assistant')];
    return list(mine, `${by('assistant').length} conversations are yours to reply to:`, 'No replies are waiting on you.');
  }
  if (/overview|brief|happening|going on|summar|status|today/.test(m)) {
    const c = (s) => by(s).length;
    return {
      answer: `${c('inbox')} active conversations. ${c('assistant')} are yours to reply to, ${c('client')} need ${client} personally, ${c('waiting')} are waiting on someone else, and ${c('review')} are flagged for your review.`,
      threadIds: [],
    };
  }
  const words = m.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !/(show|find|emails?|about|with|from|that|this|have|what|which|where|please)/.test(w));
  if (words.length) {
    const hits = threads.filter((t) => words.some((w) => `${t.subject} ${sender(t)} ${t.ai?.summary || ''}`.toLowerCase().includes(w)));
    if (hits.length) return list(hits, 'These conversations match:', '');
  }
  return {
    answer: 'I can answer questions about your inbox. Try "Which emails require the client\'s attention?", "What am I waiting on?" or open a conversation and ask me to summarize or draft a reply.',
    threadIds: [],
  };
}
