export function formatViews(count?: number | null): string | null {
  if (count === undefined || count === null) return null;
  if (count >= 1000000) {
    const m = count / 1000000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)} M vues`;
  }
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)} k vues`;
  }
  return `${count} vue${count > 1 ? 's' : ''}`;
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

export function formatUploadDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  
  // Format YYYYMMDD (e.g. 20201117)
  if (/^\d{8}$/.test(trimmed)) {
    const year = parseInt(trimmed.substring(0, 4), 10);
    const month = parseInt(trimmed.substring(4, 6), 10) - 1;
    const day = parseInt(trimmed.substring(6, 8), 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  // Format YYYY-MM-DD (e.g. 2020-11-17)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  return trimmed;
}

export function formatSubscriberCount(raw?: string | number | null): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  let num: number | null = null;

  // Match notations like "1.05M", "1,05 M", "105k"
  const mMatch = str.match(/^([\d.,]+)\s*[Mm]/);
  const kMatch = str.match(/^([\d.,]+)\s*[Kk]/);

  if (mMatch) {
    num = parseFloat(mMatch[1].replace(',', '.')) * 1000000;
  } else if (kMatch) {
    num = parseFloat(kMatch[1].replace(',', '.')) * 1000;
  } else {
    // Extract raw digits: e.g. "1050000 abonnés" -> 1050000
    const digitsOnly = str.replace(/\s+/g, '').match(/\d+/);
    if (digitsOnly) {
      num = parseInt(digitsOnly[0], 10);
    }
  }

  if (num === null || isNaN(num)) {
    return str;
  }

  if (num >= 1000000) {
    const m = num / 1000000;
    const strVal = m >= 100 ? String(Math.round(m)) : m >= 10 ? m.toFixed(1) : m.toFixed(2);
    const formatted = strVal.replace(/\.?0+$/, '').replace('.', ',');
    return `${formatted} M d'abonnés`;
  }

  if (num >= 1000) {
    const k = num / 1000;
    const strVal = k >= 100 ? String(Math.round(k)) : k.toFixed(1);
    const formatted = strVal.replace(/\.?0+$/, '').replace('.', ',');
    return `${formatted} k abonnés`;
  }

  return `${num} abonné${num > 1 ? 's' : ''}`;
}
