import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is 2 levels up from server/src or /app in Docker
export const ROOT_DIR = process.env.ROOT_DIR || (fs.existsSync('/app/package.json') ? '/app' : path.resolve(__dirname, '../../'));
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(ROOT_DIR, 'downloads');
export const COOKIES_FILE = path.join(DATA_DIR, 'cookies.txt');

// Database path (with auto-migration from legacy mytube.db)
const legacyDbPath = path.join(DATA_DIR, 'mytube.db');
export const DB_PATH = path.join(DATA_DIR, 'vidarch.db');

if (fs.existsSync(legacyDbPath) && !fs.existsSync(DB_PATH)) {
  try {
    fs.copyFileSync(legacyDbPath, DB_PATH);
    console.log('🔄 Migrated database from mytube.db to vidarch.db');
  } catch (_) {}
}

export const PORT = parseInt(process.env.PORT || '2498', 10);
export const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure data and downloads directory exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Find yt-dlp executable path
export function findYtDlpPath(): string {
  if (process.env.YT_DLP_PATH) {
    return process.env.YT_DLP_PATH;
  }
  
  // Standard paths on Windows & Linux
  const possiblePaths = [
    'yt-dlp',
    'yt-dlp.exe',
    'C:\\Users\\lucas\\AppData\\Local\\Programs\\Python\\Python313\\Scripts\\yt-dlp.exe',
    'C:\\Users\\lucas\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\yt-dlp.exe',
    'C:\\Users\\lucas\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\yt-dlp.exe',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ];

  for (const p of possiblePaths) {
    if (p.includes('/') || p.includes('\\')) {
      if (fs.existsSync(p)) return p;
    }
  }

  return 'yt-dlp';
}

// Helper to verify that a target path is safely contained inside the base directory
export function isSafePath(baseDir: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, targetPath);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}
