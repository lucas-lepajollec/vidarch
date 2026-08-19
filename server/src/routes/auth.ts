import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkPassword,
  clearPasswordHash,
  clearSessionCookie,
  getConfiguredPassword,
  isAuthRequired,
  isAuthenticated,
  savePasswordHash,
  setSessionCookie,
} from '../services/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

router.get('/status', (req, res) => {
  const cfg = getConfiguredPassword();
  res.json({
    required: cfg.source !== 'none',
    authenticated: isAuthenticated(req),
    setupAvailable: cfg.source === 'none',
    envLocked: cfg.source === 'env',
  });
});

router.post('/login', loginLimiter, (req, res) => {
  if (!isAuthRequired()) {
    return res.json({ success: true, required: false });
  }
  const password = String(req.body?.password || '');
  if (!password || !checkPassword(password)) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  setSessionCookie(req, res);
  res.json({ success: true });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.post('/setup', loginLimiter, (req, res) => {
  const cfg = getConfiguredPassword();
  if (cfg.source === 'env') {
    return res.status(400).json({ error: 'Le mot de passe est défini par AUTH_PASSWORD.' });
  }
  if (cfg.source === 'db') {
    return res.status(400).json({ error: 'Un mot de passe est déjà configuré.' });
  }
  const password = String(req.body?.password || '');
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }
  savePasswordHash(password);
  setSessionCookie(req, res);
  res.json({ success: true });
});

router.post('/password', (req, res) => {
  const cfg = getConfiguredPassword();
  if (cfg.source === 'env') {
    return res.status(400).json({ error: 'Le mot de passe est verrouillé par AUTH_PASSWORD.' });
  }

  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');

  if (cfg.source === 'db') {
    if (!isAuthenticated(req) || !checkPassword(current)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
  }

  if (next.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }
  savePasswordHash(next);
  setSessionCookie(req, res);
  res.json({ success: true });
});

router.post('/disable', (req, res) => {
  const cfg = getConfiguredPassword();
  if (cfg.source === 'env') {
    return res.status(400).json({ error: 'Impossible de désactiver AUTH_PASSWORD via l\'interface.' });
  }
  if (cfg.source === 'db') {
    const current = String(req.body?.currentPassword || '');
    if (!isAuthenticated(req) || !checkPassword(current)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
  }
  clearPasswordHash();
  clearSessionCookie(res);
  res.json({ success: true });
});

export default router;
