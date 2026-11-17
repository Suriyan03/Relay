import { db } from '../db.js';
import { config } from '../config.js';
import { analyzeThread } from '../ai/classify.js';
import { addEvent } from './workspace.js';

export const LABEL = { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed' };

export function pushActivity(thread, actor, text) {
  return [...(thread.activity || []), { at: new Date().toISOString(), actor, text }].slice(-40);
}

/** Turn an AI analysis into a patch for the thread, respecting manual overrides. */
function buildPatch(thread, a, trigger) {
  const at = new Date().toISOString();
  const pct = Math.round(a.confidence * 100);
  const lowConfidence = a.confidence < config.reviewThreshold;
  const patch = {
    ai: { ...a, at },
    category: a.category,
    dates: a.dates,
    meeting: a.meeting,
    classifying: false,
    reviewed: false,
    needsReview: lowConfidence,
    changedFrom: null,
    changedAt: null,
    suggestion: null,
  };
  if (!thread.importantLocked) patch.important = a.tags.important;

  let responsibility;
  let activityText;
  if (thread.override) {
    responsibility = thread.responsibility;
    patch.needsReview = false;
    if (a.responsibility !== thread.responsibility) {
      patch.suggestion = { responsibility: a.responsibility, reason: a.reason, confidence: a.confidence, at };
      activityText = `AI re-checked the conversation and now suggests "${LABEL[a.responsibility]}" (${pct}%). Your manual choice was kept.`;
    } else {
      activityText = `AI re-checked the conversation and agrees with your choice (${pct}%).`;
    }
  } else {
    responsibility = a.responsibility;
    const prev = thread.responsibility;
    if (prev && prev !== responsibility) {
      patch.changedFrom = prev;
      patch.changedAt = at;
      activityText = `AI reclassified this from "${LABEL[prev]}" to "${LABEL[responsibility]}" (${pct}%).`;
    } else if (trigger === 'initial') {
      activityText = `AI classified this as "${LABEL[responsibility]}" (${pct}% confident)${lowConfidence ? ' and flagged it for review.' : '.'}`;
    } else {
      activityText = `AI re-checked the conversation: still "${LABEL[responsibility]}" (${pct}%).`;
    }
  }
  patch.responsibility = responsibility;
  patch.tags = {
    action: !!a.tags.actionRequired && responsibility !== 'none',
    waiting: !!a.tags.waitingForResponse,
    meeting: !!a.tags.meeting || !!a.meeting,
  };
  patch.activity = pushActivity(thread, 'AI', activityText);
  return patch;
}

/** Run the classifier on a thread and store the result. */
export async function analyzeAndApply(threadId, trigger = 'initial') {
  const thread = await db.threads.findOne({ _id: threadId });
  if (!thread) return null;
  const ws = await db.workspaces.findOne({ _id: thread.workspaceId });
  const ctx = { clientName: ws.clientName, assistantName: ws.assistantName, now: new Date() };
  const analysis = await analyzeThread(thread, ctx);
  const fresh = (await db.threads.findOne({ _id: threadId })) || thread;
  const patch = buildPatch(fresh, analysis, trigger);
  const updated = await db.threads.patch(threadId, patch);

  if (trigger === 'new_message') {
    if (patch.changedFrom) {
      await addEvent(thread.workspaceId, {
        type: 'reclassified',
        threadId,
        text: `"${thread.subject}" moved from ${LABEL[patch.changedFrom]} to ${LABEL[patch.responsibility]}.`,
        actor: 'AI',
      });
    } else if (patch.suggestion) {
      await addEvent(thread.workspaceId, {
        type: 'reclassified',
        threadId,
        text: `AI suggests "${LABEL[patch.suggestion.responsibility]}" for "${thread.subject}". Review the suggestion.`,
        actor: 'AI',
      });
    } else if (patch.needsReview) {
      await addEvent(thread.workspaceId, { type: 'needs_review', threadId, text: `"${thread.subject}" needs your review, the AI is unsure who should reply.`, actor: 'AI' });
    }
  }
  return { thread: updated, before: fresh.responsibility, after: updated.responsibility, analysis };
}
