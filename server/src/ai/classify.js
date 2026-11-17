import { completeJSON, llmConfig } from './llm.js';
import { analyzeWithRules, CATEGORIES } from './heuristics.js';
import { fmtDayMD, parts, DAYS } from '../lib/time.js';

export function renderThread(thread, { clientName, assistantName }, maxChars = 6000) {
  const lines = thread.messages.map((m) => {
    const who =
      m.direction === 'in'
        ? `EXTERNAL – ${m.from.name} <${m.from.email}>`
        : `OUR SIDE – sent by ${m.sentBy === 'client' ? clientName : assistantName} (${m.sentBy || 'assistant'})`;
    return `[${m.at}] ${who}\n${m.body}`;
  });
  let out = `Subject: ${thread.subject}\n\n${lines.join('\n\n---\n\n')}`;
  if (out.length > maxChars) out = out.slice(-maxChars);
  return out;
}

function systemPrompt({ clientName, assistantName, now }) {
  const p = parts(now);
  return `You are the triage engine inside "Relay", an inbox workspace where a personal assistant (${assistantName}) manages email for their client (${clientName}).

For each email conversation decide who must reply NEXT:
- "assistant": the assistant should respond. Scheduling and rescheduling, routine business or vendor questions, paperwork and logistics, RSVPs that need no personal judgement, follow-ups on things already acknowledged, general admin.
- "client": ${clientName} must respond personally. Personal decisions or approvals, signatures, sensitive or confidential matters, investors/board/key customers asking for the client directly, or any message that explicitly asks for the client's own input.
- "none": nothing to send. Newsletters, receipts, automated notifications, FYI updates, calendar confirmations, resolved threads, and threads where WE sent the last message and are waiting on them.

Rules:
- Read the WHOLE conversation, especially the latest message. If the assistant already promised to check something and the sender is chasing, the assistant still owes a reply.
- Do not escalate routine items to the client. Do not treat every email as needing a reply.
- If the last message came from our side and is waiting on the other party: responsibility "none" and waitingForResponse true.
- Be honest about confidence: 0.9+ when clear, 0.5–0.7 when genuinely ambiguous. Ambiguous cases include cold outreach, personal invitations, and anything where the owner is a judgement call.
- "reason" is ONE short sentence on who should reply and why. It will be shown to ${clientName} when responsibility is "client", so write it plainly and without internal jargon.
- "summary" is two short sentences max, neutral, no greetings.
- "actionRequired" is true only when the email asks for a concrete task beyond replying (sign, pay, upload, approve, confirm headcount) and responsibility is not "none".
- "important" is true for time-critical, high-stakes, legal, financial, hiring, investor or key-customer matters.
- Dates: today is ${DAYS[p.wd]}, ${fmtDayMD(now)}, ${p.y} (India time, UTC+05:30). Resolve relative dates ("Friday") to ISO 8601 with +05:30 offset.

Return JSON with exactly these keys:
{
  "responsibility": "assistant" | "client" | "none",
  "confidence": number between 0 and 1,
  "reason": string,
  "summary": string,
  "keyPoints": string[] (max 4 short bullets),
  "category": one of ${JSON.stringify(CATEGORIES)},
  "tags": { "actionRequired": boolean, "waitingForResponse": boolean, "meeting": boolean, "important": boolean },
  "dates": [ { "label": "Deadline" | "Meeting" | "Date", "text": string, "iso": ISO string or null } ],
  "meeting": { "title": string, "startsAt": ISO string or null, "location": string or null } | null
}`;
}

function normalize(raw, fallback) {
  const responsibility = ['assistant', 'client', 'none'].includes(raw.responsibility) ? raw.responsibility : null;
  if (!responsibility) throw new Error('bad responsibility');
  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.6;
  confidence = Math.max(0, Math.min(1, confidence));
  const tags = raw.tags || {};
  const cfg = llmConfig();
  const dates = Array.isArray(raw.dates)
    ? raw.dates
        .filter((d) => d && d.text)
        .slice(0, 5)
        .map((d) => ({ label: String(d.label || 'Date'), text: String(d.text), iso: d.iso && !Number.isNaN(Date.parse(d.iso)) ? new Date(d.iso).toISOString() : null }))
    : [];
  let meeting = null;
  if (raw.meeting && raw.meeting.title) {
    const iso = raw.meeting.startsAt && !Number.isNaN(Date.parse(raw.meeting.startsAt)) ? new Date(raw.meeting.startsAt).toISOString() : null;
    meeting = { title: String(raw.meeting.title).slice(0, 120), startsAt: iso, location: raw.meeting.location ? String(raw.meeting.location).slice(0, 120) : null };
  }
  return {
    responsibility,
    confidence: Number(confidence.toFixed(2)),
    reason: String(raw.reason || fallback.reason).slice(0, 300),
    summary: String(raw.summary || fallback.summary).slice(0, 400),
    keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.slice(0, 4).map((k) => String(k).slice(0, 140)) : [],
    category: CATEGORIES.includes(raw.category) ? raw.category : fallback.category,
    tags: {
      actionRequired: !!tags.actionRequired && responsibility !== 'none',
      waitingForResponse: !!tags.waitingForResponse,
      meeting: !!tags.meeting || !!meeting,
      important: !!tags.important,
    },
    dates,
    meeting,
    source: 'llm',
    model: `${cfg.provider}/${cfg.model}`,
  };
}

/** Analyze one conversation. Uses the LLM when configured, falls back to rules on any failure. */
export async function analyzeThread(thread, ctx) {
  const now = ctx.now || new Date();
  const rules = analyzeWithRules(thread, { ...ctx, now });
  if (!llmConfig().live) return rules;
  try {
    const raw = await completeJSON({
      system: systemPrompt({ ...ctx, now }),
      user: `Today: ${now.toISOString()}\n\nCONVERSATION\n${renderThread(thread, ctx)}`,
      maxTokens: 900,
      temperature: 0.1,
    });
    return normalize(raw, rules);
  } catch (err) {
    console.warn(`[ai] LLM classify failed, using rules: ${err.message}`);
    return { ...rules, source: 'rules', fallback: true };
  }
}
