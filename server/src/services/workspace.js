import { randomUUID, randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

export async function createWorkspace({ assistantName, clientName, demo = false }) {
  const ws = {
    _id: randomUUID(),
    name: `${assistantName.split(' ')[0]}'s workspace`,
    assistantName,
    clientName,
    inviteToken: randomBytes(12).toString('hex'),
    demo,
    createdAt: new Date().toISOString(),
  };
  await db.workspaces.insert(ws);
  return ws;
}

export async function addEvent(workspaceId, { type, threadId = null, text, actor = 'Relay' }) {
  await db.events.insert({ _id: randomUUID(), workspaceId, at: new Date().toISOString(), type, threadId, text, actor });
}

export async function wipeWorkspaceData(workspaceId) {
  await db.threads.deleteWhere({ workspaceId });
  await db.accounts.deleteWhere({ workspaceId });
  await db.events.deleteWhere({ workspaceId });
}

/** Remove demo workspaces that are older than the configured TTL. */
export async function cleanupDemos() {
  try {
    const cutoff = Date.now() - config.demoTtlHours * 3600000;
    const demos = await db.workspaces.find({ demo: true });
    for (const ws of demos) {
      if (new Date(ws.createdAt).getTime() < cutoff) {
        await wipeWorkspaceData(ws._id);
        await db.users.deleteWhere({ workspaceId: ws._id });
        await db.workspaces.deleteWhere({ _id: ws._id });
      }
    }
  } catch (e) {
    console.warn('[cleanup]', e.message);
  }
}
