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
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Persist a channel image (remote URL, /media path, or data URL) and return
 * a safe URL to store in SQLite. SVG and javascript: URLs are rejected.
 */
export function persistImageInput(input: string | undefined | null, basename: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';

  if (raw.startsWith('javascript:') || raw.startsWith('data:image/svg')) {
    return '';
  }

  if (raw.startsWith('/media/assets/') || raw.startsWith('/media/downloads/')) {
    return raw;
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
  const safeBase = basename.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'img';
  const filename = `${safeBase}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const dest = path.join(ASSETS_DIR, filename);
  fs.writeFileSync(dest, buffer);
  return `/media/assets/${filename}`;
}
