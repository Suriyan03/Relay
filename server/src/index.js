import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initStore, storeKind } from './db.js';
import { llmStatus } from './ai/llm.js';
import { cleanupDemos } from './services/workspace.js';
import authRoutes from './routes/auth.js';
import assistantRoutes from './routes/assistant.js';
import clientRoutes from './routes/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  await initStore();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, store: storeKind, ai: llmStatus() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/client', clientRoutes);
  app.use('/api', assistantRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on our side. Please try again.' });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createApp();
  await cleanupDemos();
  setInterval(cleanupDemos, 3600000).unref();
  app.listen(config.port, () => {
    const ai = llmStatus();
    console.log(`Relay running on http://localhost:${config.port}`);
    console.log(`  storage: ${storeKind}${storeKind === 'memory' ? ' (set MONGODB_URI to persist)' : ''}`);
    console.log(`  ai: ${ai.live ? `${ai.provider} / ${ai.model}` : 'demo rules engine (set GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY or GEMINI_API_KEY)'}`);
  });
}
