export function formatCompactNumber(count: number, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  } catch {
    return String(count);
  }
}

export function formatViews(count?: number | null, locale = 'en-US'): string | null {
  if (count === undefined || count === null) return null;
  const compact = formatCompactNumber(count, locale);
  const lang = locale.split('-')[0];
  if (lang === 'fr') return `${compact} vue${count > 1 ? 's' : ''}`;
  if (lang === 'es') return `${compact} visualizaci${count === 1 ? 'ón' : 'ones'}`;
  if (lang === 'de') return `${compact} Aufruf${count === 1 ? '' : 'e'}`;
  return `${compact} view${count === 1 ? '' : 's'}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatUploadDate(dateStr?: string | null, locale = 'en-US'): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();

  const format = (date: Date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  if (/^\d{8}$/.test(trimmed)) {
    const year = parseInt(trimmed.substring(0, 4), 10);
    const month = parseInt(trimmed.substring(4, 6), 10) - 1;
    const day = parseInt(trimmed.substring(6, 8), 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return format(date);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return format(date);
  }

  return trimmed;
}

export function formatSubscriberCount(raw?: string | number | null, locale = 'en-US'): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  let num: number | null = null;
  const mMatch = str.match(/^([\d.,]+)\s*[Mm]/);
  const kMatch = str.match(/^([\d.,]+)\s*[Kk]/);

  if (mMatch) {
    num = parseFloat(mMatch[1].replace(',', '.')) * 1000000;
  } else if (kMatch) {
    num = parseFloat(kMatch[1].replace(',', '.')) * 1000;
  } else {
    const digitsOnly = str.replace(/\s+/g, '').match(/\d+/);
    if (digitsOnly) num = parseInt(digitsOnly[0], 10);
  }

  if (num === null || isNaN(num)) return str;

  const compact = formatCompactNumber(num, locale);
  const lang = locale.split('-')[0];
  if (lang === 'fr') return `${compact} abonné${num > 1 ? 's' : ''}`;
  if (lang === 'es') return `${compact} suscriptor${num === 1 ? '' : 'es'}`;
  if (lang === 'de') return `${compact} Abonnent${num === 1 ? '' : 'en'}`;
  return `${compact} subscriber${num === 1 ? '' : 's'}`;
}

export function formatFileSize(bytes?: number | null, locale = 'en'): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  const lang = locale.split('-')[0];
  const gbLabel = lang === 'fr' ? 'Go' : 'GB';
  const mbLabel = lang === 'fr' ? 'Mo' : 'MB';
  if (mb >= 1024) {
    const n = mb >= 10240 ? (mb / 1024).toFixed(0) : (mb / 1024).toFixed(1);
    return `${n} ${gbLabel}`;
  }
  const n = mb >= 100 ? mb.toFixed(0) : mb.toFixed(1);
  return `${n} ${mbLabel}`;
}
