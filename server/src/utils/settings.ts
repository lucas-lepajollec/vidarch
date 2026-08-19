import { db } from '../db/database.js';

export function getSetting(key: string, fallback = ''): string {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export function isLocalOnly(): boolean {
  return getSetting('local_only', 'false') === 'true';
}

export function isScanEnabled(): boolean {
  return getSetting('scan_enabled', 'true') !== 'false';
}

export function getConcurrentDownloads(): number {
  const n = parseInt(getSetting('concurrent_downloads', '2'), 10);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(4, n));
}

export type UiLanguage = 'en' | 'fr' | 'es' | 'de';

export function getUiLanguage(): UiLanguage {
  const v = getSetting('ui_language', 'en');
  if (v === 'fr' || v === 'es' || v === 'de' || v === 'en') return v;
  return 'en';
}
