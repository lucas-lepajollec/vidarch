import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { DATA_DIR } from '../config.js';
import { db } from '../db/database.js';

const SECRET_FILE = path.join(DATA_DIR, '.session_secret');
const COOKIE_NAME = 'vidarch_session';
const SESSION_DAYS = 30;
const HASH_PREFIX = 'scrypt';

function getSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
  } catch {
    // fall through and regenerate
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.warn('Could not persist session secret:', (err as Error).message);
  }
  return generated;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${HASH_PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [prefix, saltHex, hashHex] = stored.split('$');
    if (prefix !== HASH_PREFIX || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function getConfiguredPassword(): { source: 'env' | 'db' | 'none'; hash?: string; envPlain?: string } {
  const envPass = process.env.AUTH_PASSWORD || process.env.VIDARCH_AUTH_PASSWORD;
  if (envPass && envPass.trim()) {
    return { source: 'env', envPlain: envPass.trim() };
  }
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('auth_password_hash') as { value: string } | undefined;
    if (row?.value) return { source: 'db', hash: row.value };
  } catch {
    // db not ready
  }
  return { source: 'none' };
}

export function isAuthRequired(): boolean {
  return getConfiguredPassword().source !== 'none';
}

export function checkPassword(password: string): boolean {
  const cfg = getConfiguredPassword();
  if (cfg.source === 'env' && cfg.envPlain) {
    const a = Buffer.from(password);
    const b = Buffer.from(cfg.envPlain);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  if (cfg.source === 'db' && cfg.hash) {
    return verifyPassword(password, cfg.hash);
  }
  return false;
}

export function savePasswordHash(password: string): void {
  const hash = hashPassword(password);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('auth_password_hash', hash);
}

export function clearPasswordHash(): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run('auth_password_hash');
}

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    iat: Date.now(),
    v: 1,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function isAuthenticated(req: Request): boolean {
  if (!isAuthRequired()) return true;
  return verifySessionToken(readSessionCookie(req));
}

export function setSessionCookie(req: Request, res: Response): void {
  const token = createSessionToken();
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
