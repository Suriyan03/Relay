import { MONTHS, DAYS, parts, fromIST, addDays } from '../lib/time.js';

/**
 * Rule-based analysis. Same output shape as the LLM path, used when no API key
 * is configured or when an LLM call fails, so the product never breaks.
 */

export const CATEGORIES = [
  'Scheduling', 'Finance', 'Legal', 'Hiring', 'Investors', 'Customers', 'Travel',
  'Personal', 'Newsletter', 'Notification', 'Outreach', 'Admin', 'Other',
];

const NOREPLY_SENDER =
  /(no[-_.]?reply|do-?not-?reply|notifications?@|newsletter|digest@|mailer|news@|alerts?@|statements?@|billing@|invoice@|calendar-notification|marketing@)/i;
const AUTOMATED_BODY =
  /(unsubscribe|this is an automated|do not reply|please do not reply|system-generated|you are receiving this|invitation from google calendar|manage preferences)/i;
const PROMISE = /\b(will (send|share|revert|get back|check|confirm|update)|i'll (check|revert|send|get back)|shall revert|let me check|get back to you)\b/i;
const CLOSING = /\b(all set|sounds good|see you|noted\.|works perfectly|perfect,? thanks|got it)\b/i;

const CLIENT_SIGNALS = [
  [/\byour (approval|sign-?off|signature|decision|thoughts|view|position)\b/i, 3],
  [/\b(signature|docusign|sign via|execution)\b/i, 2.5],
  [/\bapprov(e|al)\b/i, 2],
  [/\b(confidential|privately|between us|sensitive)\b/i, 3],
  [/\b(hear from|speak (to|with)|talk (to|with)) (you|him|her|\w+ directly)|directly\b/i, 2.5],
  [/\b(term sheet|valuation|esop|offer|resign|step down|board|sale deed|signatory|liability|renewal|renew)\b/i, 2],
  [/\bneed your\b|\bbefore (we|i) (send|proceed)\b|\bthis needs your decision\b/i, 2.5],
  [/\b(do you want|would you be open|are you comfortable|please confirm you|please share your decision|confirm whether|work for you)\b/i, 1.5],
  [/\b(comfortable with this amount|confirm .{0,30}amount|before we (generate|proceed|file))\b/i, 2],
  [/\b(would love to have you|join us|invite[sd]? you|if you can make it)\b/i, 2],
];
const ASSISTANT_SIGNALS = [
  [/\b(reschedul|schedule|slot|availability|calendar)\w*/i, 2.5],
  [/\b(headcount|dietary|quote|proposal form|receipts?|upload|documents?|forms?|certificate|employee list|submit|timeline)\b/i, 2],
  [/\b(reply (c|with)|kindly reply|please (send|share|upload|reply))\b/i, 2],
  [/\b(following up|follow up|any update|just checking|circling back)\b/i, 2.5],
  [/\b(preferred slot|which (option|slot|one))\b/i, 2],
  [/\b(confirm (the )?(final )?(headcount|attendance|slot|time|appointment))\b/i, 2],
  [/\b(let me know|rsvp)\b/i, 1],
  [/\b(open to a (quick )?(call|chat)|quick chat|explore)\b/i, 1.2],
  [/\b(could we do|can we move|move (this|the))\b/i, 2],
];
const ACTION_VERBS = /\b(sign|approv(e|al)|upload|submit|pay|send (the|these|us)|share (the|these)|confirm (the )?(final )?(headcount|attendance|slot|amount)|complete|fill|reply c|provide)\b/i;

const CATEGORY_RULES = [
  ['Newsletter', /\b(digest|newsletter|weekly|top launches|unsubscribe)\b/i],
  ['Personal', /\b(dinner|school|parent|dentist|check-up|reservation)\b/i],
  ['Investors', /\b(term sheet|valuation|series [a-d]|investor)\b/i],
  ['Legal', /\b(msa|contract|agreement|signature|sale deed|clause|counsel|legal|liabilit)/i],
  ['Hiring', /\b(offer for|candidate|hiring|resign|step down|esop|panel)\b/i],
  ['Customers', /\b(outage|dashboard|renew in|incident|customer)\b/i],
  ['Travel', /\b(flight|booking|pnr|itinerary|singapore|departure)\b/i],
  ['Admin', /\b(insurance|policy|venue|offsite)\b/i],
  ['Scheduling', /\b(reschedul|appointment|slot|meeting|sync|lunch|interview)\b/i],
  ['Finance', /\b(gst|invoice|tax|expense|statement|receipt|bank|payment)\b/i],
  ['Outreach', /\b(partnership|co-marketing|quick intro)\b/i],
  ['Admin', /\b(vendor|quote|delivery)\b/i],
];

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const firstSentence = (s) => (clean(s).match(/^.{20,}?[.!?](\s|$)/) || [clean(s).slice(0, 140)])[0].trim();

export function parseDates(text, now = new Date()) {
  const out = [];
  const seen = new Set();
  const today = parts(now);
  const base = fromIST(today.y, today.m, today.d);
  const timeNear = (idx, len) => {
    const tail = text.slice(idx + len, idx + len + 30);
    const m = /(\d{1,2})(?::(\d{2}))?\s?(AM|PM)/i.exec(tail);
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return { h, min: Number(m[2] || 0) };
  };
  const label = (idx) => (/(by|before|until|due|deadline|on or before)\s*(on\s*)?$/i.test(text.slice(Math.max(0, idx - 18), idx)) ? 'Deadline' : 'Date');
  const push = (date, t, raw, idx) => {
    const p = parts(date);
    const withTime = t ? fromIST(p.y, p.m, p.d, t.h, t.min) : fromIST(p.y, p.m, p.d, 9, 0);
    const key = withTime.toISOString();
    if (seen.has(key + raw)) return;
    seen.add(key + raw);
    out.push({ label: label(idx), text: raw, iso: withTime.toISOString(), hasTime: !!t });
  };
  const monthRe = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.? (\\d{1,2})\\b`, 'g');
  let m;
  while ((m = monthRe.exec(text))) {
    const mi = MONTHS.indexOf(m[1]);
    let y = today.y;
    let d = fromIST(y, mi, Number(m[2]));
    if (d.getTime() < base.getTime() - 86400000) d = fromIST(y + 1, mi, Number(m[2]));
    push(d, timeNear(m.index, m[0].length), m[0], m.index);
  }
  const dayRe = new RegExp(`\\b(${DAYS.join('|')})\\b`, 'g');
  while ((m = dayRe.exec(text))) {
    const target = DAYS.indexOf(m[1]);
    let delta = (target - today.wd + 7) % 7;
    if (delta === 0) delta = 7;
    push(addDays(base, delta), timeNear(m.index, m[0].length), m[0], m.index);
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso)).slice(0, 5).map(({ hasTime, ...rest }) => ({ ...rest, hasTime }));
}

export function analyzeWithRules(thread, ctx = {}) {
  const now = ctx.now || new Date();
  const msgs = thread.messages;
  const last = msgs[msgs.length - 1];
  const lastIn = [...msgs].reverse().find((m) => m.direction === 'in');
  const text = clean(`${thread.subject} ${last.body}`);
  const fullText = clean(msgs.map((m) => m.body).join(' ')) + ' ' + thread.subject;
  const senderAddr = (lastIn || last).from.email + ' ' + (lastIn || last).from.name;
  const ageHours = (now.getTime() - new Date(last.at).getTime()) / 3600000;

  let responsibility = 'none';
  let confidence = 0.6;
  let reason = 'Looks informational, nothing to respond to.';
  let waiting = false;

  const cs = CLIENT_SIGNALS.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), 0);
  const as = ASSISTANT_SIGNALS.reduce((s, [re, w]) => s + (re.test(text) ? w : 0), 0);
  const question = /\?/.test(last.body);
  const automated = last.direction === 'in' && (NOREPLY_SENDER.test(senderAddr) || AUTOMATED_BODY.test(last.body));

  if (automated && cs < 3 && !/\breply (c|with)\b/i.test(last.body)) {
    responsibility = 'none';
    confidence = 0.95;
    reason = 'Automated notification or newsletter, no reply expected.';
  } else if (last.direction === 'out') {
    if (PROMISE.test(last.body) && ageHours > 48) {
      responsibility = 'assistant';
      confidence = 0.6;
      reason = `A reply was promised ${Math.round(ageHours / 24)} days ago and nothing has gone out since. This probably needs a follow-up.`;
    } else {
      responsibility = 'none';
      waiting = true;
      confidence = 0.9;
      reason = 'The last message was sent from this mailbox, so the next move is theirs.';
    }
  } else if (CLOSING.test(last.body) && !question && cs < 2 && as < 2.5) {
    responsibility = 'none';
    confidence = 0.84;
    reason = 'The conversation looks resolved, the other side confirmed and nothing is outstanding.';
  } else if (cs >= 3 && cs > as + 0.5) {
    responsibility = 'client';
    confidence = Math.min(0.95, 0.66 + (cs - as) * 0.05);
    reason = clientReason(text);
  } else if (as >= 2 && as >= cs) {
    responsibility = 'assistant';
    confidence = Math.min(0.93, 0.66 + (as - cs) * 0.05 + (question ? 0.05 : 0));
    reason = assistantReason(text, msgs);
  } else if (cs > 0 || as > 0) {
    responsibility = cs > as ? 'client' : 'assistant';
    confidence = 0.55;
    reason =
      responsibility === 'client'
        ? 'Reads like a personal invitation or decision, but it is not clear whether the client or the assistant should respond.'
        : 'Unsolicited request, unclear whether it deserves a reply at all.';
  } else if (question) {
    responsibility = 'assistant';
    confidence = 0.5;
    reason = 'Asks a question but gives little context to decide who should answer.';
  }

  const cold = last.direction === 'in' && !automated && /\b(partnership|co-marketing|i lead|we work with \d+)/i.test(text);
  if (cold) {
    responsibility = 'assistant';
    confidence = 0.58;
    reason = 'Unsolicited outreach. The assistant could decline, ask for details or ignore it, which is a judgement call.';
  }

  const dates = parseDates(last.body + ' ' + thread.subject, now);
  const meetingWords = /\b(meeting|call|appointment|reservation|interview|lunch|dinner|sync|invitation|slot|flight|booking|ptm|check-up)\b/i;
  const isMeeting = meetingWords.test(thread.subject) || (/\b(call|slot|meet)\b/i.test(last.body) && dates.length > 0);
  const timed = dates.find((d) => d.hasTime);
  const upcoming = dates.find((d) => new Date(d.iso).getTime() > now.getTime() && d.hasTime);
  const meeting = isMeeting && (upcoming || timed)
    ? { title: thread.subject.replace(/^(re|fwd?|accepted|reschedule):\s*/i, '').replace(/\s*[–-]\s*(Thu|Fri|Sat|Sun|Mon|Tue|Wed),.*$/, ''), startsAt: (upcoming || timed).iso, location: /Toit, Indiranagar/.test(last.body) ? 'Toit, Indiranagar' : null }
    : null;

  const deadline = dates.find((d) => d.label === 'Deadline');
  const soon = deadline && new Date(deadline.iso).getTime() - now.getTime() < 3.2 * 86400000;
  const important =
    responsibility === 'client' && (cs >= 4 || /\b(board|term sheet|resign|offer|signature|outage|sale deed)\b/i.test(text)) ||
    /\b(urgent|asap|confidential)\b/i.test(text) ||
    (soon && responsibility !== 'none');
  const actionRequired = responsibility !== 'none' && (ACTION_VERBS.test(last.body) || !!deadline);

  let category = 'Other';
  for (const [c, re] of CATEGORY_RULES) if (re.test(`${thread.subject} ${last.body}`)) { category = c; break; }
  if (automated && category === 'Other') category = 'Notification';

  const summary = summarize(thread, last, lastIn);
  const keyPoints = [];
  if (deadline) keyPoints.push(`Deadline: ${deadline.text}`);
  const amount = /(?:₹|\$)\s?[\d,.]+[LMk]?/.exec(fullText);
  if (amount) keyPoints.push(`Amount mentioned: ${amount[0]}`);
  if (msgs.length > 2) keyPoints.push(`${msgs.length} messages in this conversation`);
  if (waiting) keyPoints.push('Waiting for the other side to respond');

  return {
    responsibility,
    confidence: Number(confidence.toFixed(2)),
    reason,
    summary,
    keyPoints,
    category,
    tags: { actionRequired, waitingForResponse: waiting, meeting: !!isMeeting, important: !!important },
    dates: dates.map(({ label, text, iso }) => ({ label, text, iso })),
    meeting,
    source: 'rules',
  };
}

function clientReason(text) {
  if (/confidential|privately|between us/i.test(text)) return 'A confidential personal matter addressed to the client, so it should not be handled on their behalf.';
  if (/signature|docusign|sign via/i.test(text)) return 'Needs the client’s personal signature.';
  if (/term sheet|valuation/i.test(text)) return 'Investor terms need the client’s own decision.';
  if (/approv|offer/i.test(text)) return 'Asks for the client’s explicit approval before anything moves forward.';
  if (/directly|hear from|speak/i.test(text)) return 'The sender asked to hear from the client directly on a relationship-critical issue.';
  if (/sale deed|signatory|renew/i.test(text)) return 'A personal or contractual decision that only the client can make.';
  return 'Asks for the client’s own input or decision.';
}

function assistantReason(text, msgs) {
  const prior = msgs.some((m) => m.direction === 'out' && m.sentBy === 'assistant');
  if (/following up|follow up|any update/i.test(text) && prior) return 'The sender is following up on something the assistant already acknowledged, so a reply is owed.';
  if (/reschedul|slot|schedule|calendar|availability/i.test(text)) return 'A scheduling request the assistant can resolve from the calendar.';
  if (/reply (c|with)/i.test(text)) return 'A routine confirmation the assistant can send.';
  if (/receipts?|upload|documents?|forms?|certificate|employee list/i.test(text)) return 'Routine paperwork the assistant can gather and send.';
  if (/headcount|quote|dietary/i.test(text)) return 'A vendor logistics question the assistant can answer.';
  return 'A routine request the assistant can handle.';
}

function summarize(thread, last, lastIn) {
  const who = (lastIn || last).from.name.replace(/<.*>/, '').trim();
  const body = last.body.split('\n').filter((l) => l.trim() && !/^(hi|hello|dear|hey)\b/i.test(l.trim())).join(' ');
  const gist = firstSentence(body);
  if (last.direction === 'out') return `Last message was sent to ${who}. ${firstSentence(last.body)}`;
  return `${who}: ${gist}`;
}
