import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { isSafePath as checkSafePath, ensureDir } from './utils/paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = process.env.ROOT_DIR || (fs.existsSync('/app/package.json') ? '/app' : path.resolve(__dirname, '../../'));
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(ROOT_DIR, 'downloads');
export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const COOKIES_FILE = path.join(DATA_DIR, 'cookies.txt');

const legacyDbPath = path.join(DATA_DIR, 'mytube.db');
export const DB_PATH = path.join(DATA_DIR, 'vidarch.db');

if (fs.existsSync(legacyDbPath) && !fs.existsSync(DB_PATH)) {
  try {
    fs.copyFileSync(legacyDbPath, DB_PATH);
    console.log('Migrated database from mytube.db to vidarch.db');
  } catch (_) {}
}

export const PORT = parseInt(process.env.PORT || '2498', 10);
export const IS_PROD = process.env.NODE_ENV === 'production';

ensureDir(DATA_DIR);
ensureDir(DOWNLOADS_DIR);
ensureDir(ASSETS_DIR);

export function findYtDlpPath(): string {
  if (process.env.YT_DLP_PATH) {
    return process.env.YT_DLP_PATH;
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const names = process.platform === 'win32' ? ['yt-dlp.exe', 'yt-dlp'] : ['yt-dlp'];
  for (const name of names) {
    try {
      const out = execFileSync(cmd, [name], { encoding: 'utf-8', timeout: 4000, windowsHide: true }).trim();
      const first = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    } catch (_) {}
  }

  const possiblePaths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(ROOT_DIR, 'bin', 'yt-dlp'),
    path.join(ROOT_DIR, 'bin', 'yt-dlp.exe'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }

  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

export const isSafePath = checkSafePath;
export { resolveInside } from './utils/paths.js';
