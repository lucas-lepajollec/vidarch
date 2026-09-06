import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ASSETS_DIR } from '../config.js';
import { ensureDir } from './paths.js';

const ALLOWED_DATA_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_DATA_URL_BYTES = 2 * 1024 * 1024;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Persist a channel image (remote URL, /media path, or data URL) and return
 * a safe URL to store in SQLite. SVG and javascript: URLs are rejected.
 */
export function persistImageInput(input: string | undefined | null, _basename: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';

  for (const prefix of ['/media/assets/', '/media/downloads/']) {
    if (raw.startsWith(prefix)) {
      const relative = raw.slice(prefix.length);
      if (!relative || relative.includes('..') || relative.includes('\\') || relative.includes('\0')) return '';
      return `${prefix}${relative}`;
    }
  }

  if (isHttpUrl(raw)) {
    return raw;
  }

  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return '';

  const mime = match[1].toLowerCase();
  const ext = ALLOWED_DATA_TYPES[mime];
  if (!ext) return '';

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return '';
  }
  if (!buffer.length || buffer.length > MAX_DATA_URL_BYTES) return '';

  ensureDir(ASSETS_DIR);
  const filename = `img_${crypto.randomBytes(12).toString('hex')}${ext}`;
  const dest = path.join(ASSETS_DIR, filename);
  fs.writeFileSync(dest, buffer);
  return `/media/assets/${filename}`;
}
