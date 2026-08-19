import type { Request, Response, NextFunction } from 'express';
import { isAuthRequired, isAuthenticated } from '../services/auth.js';

const PUBLIC_API = new Set([
  'GET /api/health',
  'GET /api/auth/status',
  'POST /api/auth/login',
  'POST /api/auth/setup',
  'POST /api/auth/logout',
]);

function requestKey(req: Request): string {
  const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
  return `${req.method.toUpperCase()} ${pathOnly}`;
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  if (!isAuthRequired()) return next();

  const key = requestKey(req);
  if (PUBLIC_API.has(key)) return next();

  const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
  const isProtected =
    pathOnly.startsWith('/api/') ||
    pathOnly.startsWith('/media/');

  if (!isProtected) return next();

  if (isAuthenticated(req)) return next();

  if (pathOnly.startsWith('/media/')) {
    return res.status(401).send('Authentification requise');
  }
  return res.status(401).json({ error: 'Authentification requise', code: 'AUTH_REQUIRED' });
}
