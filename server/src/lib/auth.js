import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const sign = (payload) => jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });

export function auth(role) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'You are not signed in.' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (role && payload.role !== role) return res.status(403).json({ error: 'This area is not available for your account.' });
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Your session expired. Please sign in again.' });
    }
  };
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
