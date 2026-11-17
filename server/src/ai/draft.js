import { completeText, llmConfig } from './llm.js';
import { renderThread } from './classify.js';
import { addDays, fmtDayMD, parts } from '../lib/time.js';

const firstName = (name) => (name || '').replace(/["']/g, '').split(/[\s,]/).filter(Boolean)[0] || 'there';

function signature(voice, ctx) {
  return voice === 'client'
    ? `Best regards,\n${ctx.clientName}`
    : `Best regards,\n${ctx.assistantName}\nExecutive Assistant to ${ctx.clientName}`;
}

function businessDays(now, n) {
  const out = [];
  let d = now;
  while (out.length < n) {
    d = addDays(d, 1);
    const wd = parts(d).wd;
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
}

function detectIntent(thread, instruction) {
  const last = thread.messages[thread.messages.length - 1];
  const text = `${thread.subject} ${last.body} ${instruction || ''}`.toLowerCase();
  if (/\b(decline|politely decline|pass on|not interested|unable to)\b/.test(instruction?.toLowerCase() || '')) return 'decline';
  if (/reschedul|slot|schedule|availab|calendar|call|interview|preferred/.test(text)) return 'schedule';
  if (/following up|any update|just checking/.test(text)) return 'followup';
  if (/receipt|document|upload|form|certificate|list|figures|headcount|quote|dietary/.test(text)) return 'documents';
  if (/approv|decision|confirm whether|sign|term sheet|offer|renew|comfortable|clarification|deed/.test(text)) return 'decision';
  if (/thank|confirmed|all set/.test(text)) return 'ack';
  return 'general';
}

export function fallbackDraft(thread, ctx, { tone = 'professional', instruction = '', voice = 'assistant' } = {}) {
  const now = ctx.now || new Date();
  const lastIn = [...thread.messages].reverse().find((m) => m.direction === 'in') || thread.messages[0];
  const to = firstName(lastIn.from.name);
  const subjectLine = thread.subject.replace(/^re:\s*/i, '');
  const intent = detectIntent(thread, instruction);
  const brief = tone === 'brief' || /shorter|brief|concise/i.test(instruction);
  const warm = tone === 'warm' || /friendly|warm/i.test(instruction);
  const [d1, d2] = businessDays(now, 2);
  const she = voice === 'client' ? 'I' : ctx.clientName.split(' ')[0];
  const openers = warm ? `Hi ${to},\n\nHope your week is going well.` : `Hi ${to},\n\nThank you for your email.`;
  let body;
  switch (intent) {
    case 'schedule':
      body = voice === 'client'
        ? `I can make ${fmtDayMD(d1)} or ${fmtDayMD(d2)} work. Please send over whichever time suits you and I'll confirm it.`
        : `${she} is available on ${fmtDayMD(d1)} (morning) or ${fmtDayMD(d2)} (afternoon). Please let me know which works best and I'll send a calendar invite right away.`;
      break;
    case 'followup':
      body = `Apologies for the delay on this. I'm checking ${voice === 'client' ? 'my' : `${she}'s`} calendar now and will send you confirmed options by end of day tomorrow.`;
      break;
    case 'documents':
      body = `Thanks for the details. I'll gather what you need and send it across by ${fmtDayMD(d2)}. If anything else is required in the meantime, please let me know.`;
      break;
    case 'decision':
      body = voice === 'client'
        ? `Thanks for laying this out. I've reviewed it and will confirm my decision by ${fmtDayMD(d1)}. Please hold off on any next steps until then.`
        : `Thank you for sending this. I've shared it with ${she} and will come back to you with a decision by ${fmtDayMD(d1)}.`;
      break;
    case 'decline':
      body = `Thank you for thinking of ${voice === 'client' ? 'me' : she}. Unfortunately we're not able to take this forward at the moment, but we appreciate you reaching out and wish you all the best.`;
      break;
    case 'ack':
      body = `Thanks, that's all noted on our side. Appreciate the quick turnaround.`;
      break;
    default:
      body = `I've noted this and will get back to you shortly with a proper response regarding "${subjectLine}".`;
  }
  const text = brief ? `Hi ${to},\n\n${body}` : `${openers}\n\n${body}`;
  return `${text}\n\n${signature(voice, ctx)}`;
}

export async function draftReply(thread, ctx, opts = {}) {
  const { tone = 'professional', instruction = '', voice = 'assistant' } = opts;
  if (!llmConfig().live) return { body: fallbackDraft(thread, ctx, opts), source: 'rules' };
  const who = voice === 'client'
    ? `Write in the first person AS ${ctx.clientName} (the client). It will be reviewed by ${ctx.assistantName}, their assistant, before sending. Sign off as ${ctx.clientName}.`
    : `Write AS ${ctx.assistantName}, the executive assistant replying on behalf of ${ctx.clientName}. Refer to ${ctx.clientName} in the third person. Sign off with "${ctx.assistantName}, Executive Assistant to ${ctx.clientName}".`;
  try {
    const body = await completeText({
      system: `You draft email replies. ${who}
Tone: ${tone}. Be concise and specific to what the sender actually asked. Never invent facts, prices, availability or decisions that are not in the conversation. If a decision or detail is missing, say it will be confirmed by a specific day rather than making one up. Output ONLY the email body, starting with the greeting. No subject line, no markdown, no commentary.`,
      user: `${instruction ? `Extra instruction from the user: ${instruction}\n\n` : ''}CONVERSATION\n${renderThread(thread, ctx)}`,
      maxTokens: 500,
      temperature: 0.5,
    });
    return { body: body.replace(/^```.*\n?|```$/g, '').trim(), source: 'llm' };
  } catch (err) {
    console.warn(`[ai] draft failed, using template: ${err.message}`);
    return { body: fallbackDraft(thread, ctx, opts), source: 'rules', fallback: true };
  }
}
