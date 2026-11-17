import { MongoClient } from 'mongodb';
import { config } from './config.js';

/**
 * Tiny storage layer. Uses MongoDB when MONGODB_URI is set, otherwise an
 * in-memory store (data resets on restart) so the app always boots.
 * Every document has a string `_id`.
 */

const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => doc[k] === v);

class MemCol {
  constructor() {
    this.docs = [];
  }
  async find(filter = {}) {
    return this.docs.filter((d) => matches(d, filter)).map((d) => structuredClone(d));
  }
  async findOne(filter = {}) {
    const d = this.docs.find((x) => matches(x, filter));
    return d ? structuredClone(d) : null;
  }
  async insert(doc) {
    this.docs.push(structuredClone(doc));
  }
  async insertMany(docs) {
    for (const d of docs) this.docs.push(structuredClone(d));
  }
  async patch(id, fields) {
    const d = this.docs.find((x) => x._id === id);
    if (!d) return null;
    Object.assign(d, structuredClone(fields));
    return structuredClone(d);
  }
  async deleteWhere(filter = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return before - this.docs.length;
  }
}

class MongoCol {
  constructor(col) {
    this.col = col;
  }
  find(filter = {}) {
    return this.col.find(filter).toArray();
  }
  findOne(filter = {}) {
    return this.col.findOne(filter);
  }
  async insert(doc) {
    await this.col.insertOne(doc);
  }
  async insertMany(docs) {
    if (docs.length) await this.col.insertMany(docs);
  }
  async patch(id, fields) {
    return this.col.findOneAndUpdate({ _id: id }, { $set: fields }, { returnDocument: 'after' });
  }
  async deleteWhere(filter = {}) {
    const r = await this.col.deleteMany(filter);
    return r.deletedCount;
  }
}

const NAMES = ['users', 'workspaces', 'accounts', 'threads', 'events'];
export const db = {};
export let storeKind = 'memory';

export async function initStore() {
  if (config.mongoUri) {
    const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();
    const database = client.db(config.mongoDb);
    for (const n of NAMES) db[n] = new MongoCol(database.collection(n));
    await database.collection('users').createIndex({ email: 1 }, { unique: true });
    await database.collection('threads').createIndex({ workspaceId: 1 });
    await database.collection('accounts').createIndex({ workspaceId: 1 });
    await database.collection('events').createIndex({ workspaceId: 1 });
    storeKind = 'mongodb';
  } else {
    for (const n of NAMES) db[n] = new MemCol();
    storeKind = 'memory';
  }
  return storeKind;
}
