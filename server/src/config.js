import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'relay-dev-secret-change-me',
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'relay',
  // Conversations the AI is less sure about than this get flagged "Needs review".
  reviewThreshold: Number(process.env.REVIEW_THRESHOLD || 0.7),
  demoTtlHours: Number(process.env.DEMO_TTL_HOURS || 48),
};
