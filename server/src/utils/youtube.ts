const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  return /^https?:\/\//i.test(s) || /^file:/i.test(s) || /^www\./i.test(s);
}

export function isYouTubeVideoId(id: string | undefined | null): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (isYouTubeVideoId(trimmed)) return trimmed;
  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Allow yt-dlp targets that are YouTube URLs, handles, or channel IDs.
 * Reject file://, IP literals, non-YouTube hosts, and URLs with credentials.
 */
export function isAllowedYouTubeTarget(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (!looksLikeUrl(trimmed)) {
    if (trimmed.startsWith('@')) return trimmed.length < 128;
    if (/^(UC|HC)[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return true;
    // Plain search query
    return !trimmed.includes('://');
  }

  try {
    const withProto = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
    const u = new URL(withProto);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.includes(':')) return false; // IPv6
    return YT_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function normalizeYouTubeUrl(input: string): string {
  const trimmed = input.trim();
  if (!looksLikeUrl(trimmed)) return trimmed;
  const withProto = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const u = new URL(withProto);
    u.hash = '';
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  } catch {
    return trimmed;
  }
}

export function youtubeThumbUrl(videoId: string, variant: 'hqdefault' | 'mqdefault' | 'sddefault' | 'maxresdefault' | 'hq720' | '0' = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${variant}.jpg`;
}

export function sanitizeThumbUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('ytimg.com')) {
      u.search = '';
      u.hash = '';
      return u.toString();
    }
  } catch (_) {}
  return url;
}

export function sanitizeAvatarUrl(url?: string | null): string {
  if (!url) return '';
  return url.replace(/=s0(?=$|[-?&])/i, '=s240-c-k-c0x00ffffff-no-rj');
}

export function youtubeThumbFallbacks(videoId: string): string[] {
  return [
    youtubeThumbUrl(videoId, 'maxresdefault'),
    youtubeThumbUrl(videoId, 'sddefault'),
    youtubeThumbUrl(videoId, 'hq720'),
    youtubeThumbUrl(videoId, 'hqdefault'),
    youtubeThumbUrl(videoId, 'mqdefault'),
  ];
}

function asLangCode(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const code = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  return /^[a-z]{2,3}$/.test(code) ? code : '';
}

/**
 * Spoken / original language of a video or channel.
 * Prefer original/audio language over `language`, which yt-dlp may set to the
 * requested interface language after a localized fetch.
 */
export function pickContentLanguage(json: any): string {
  const candidates = [
    json?.original_language,
    json?.audio_language,
    json?.asr,
    json?.creator_language,
    Array.isArray(json?.language) ? json.language[0] : null,
    typeof json?.language === 'string' ? json.language : null,
    json?.requested_language,
  ];
  for (const c of candidates) {
    const code = asLangCode(c);
    if (code) return code;
  }
  const subs = json?.subtitles && typeof json.subtitles === 'object' ? Object.keys(json.subtitles) : [];
  for (const key of subs) {
    if (key === 'live_chat') continue;
    const code = asLangCode(key);
    if (code) return code;
  }
  return '';
}

export function buildYtDlpLangArgs(): string[] {
  return [
    '--js-runtimes', 'node',
    // Never mix android_vr with web: web DASH URLs 403 without a PO token.
    '--extractor-args', 'youtube:player_client=android_vr',
  ];
}

export function pickVideoThumbnail(item: {
  id?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
}): string {
  const fromItem = sanitizeThumbUrl(item.thumbnail);
  if (fromItem) return fromItem;
  if (item.thumbnails?.length) {
    const last = item.thumbnails[item.thumbnails.length - 1];
    const fromList = sanitizeThumbUrl(last?.url);
    if (fromList) return fromList;
  }
  if (item.id && isYouTubeVideoId(item.id)) {
    return youtubeThumbUrl(item.id);
  }
  return '';
}

export function pickChannelImages(json: any): { avatarUrl: string; bannerUrl: string } {
  let avatarUrl = String(json?.channel_avatar || json?.avatar || json?.uploader_avatar || '');
  let bannerUrl = String(json?.banner_url || json?.channel_banner || json?.banner || '');

  const thumbs: Array<{ url?: string; id?: string; width?: number; height?: number }> = Array.isArray(json?.thumbnails)
    ? json.thumbnails
    : [];

  for (const t of thumbs) {
    if (!t?.url) continue;
    const id = String(t.id || '');
    if (id === 'avatar_uncropped' || id.includes('avatar')) {
      avatarUrl = t.url;
    } else if (id === 'banner_uncropped' || id.includes('banner')) {
      bannerUrl = t.url;
    }
  }

  if (!avatarUrl) {
    const square = [...thumbs].reverse().find((t) => t.url && t.width && t.height && t.width === t.height);
    if (square?.url) avatarUrl = square.url;
  }
  if (!avatarUrl) {
    const cropped = thumbs.find((t) => t.url && t.url.includes('-c-k-c0x00ffffff'));
    if (cropped?.url) avatarUrl = cropped.url;
  }
  if (!bannerUrl) {
    const wide = thumbs.find((t) => t.url && t.width && t.height && t.width / t.height > 2.5);
    if (wide?.url) bannerUrl = wide.url;
  }

  return { avatarUrl: sanitizeAvatarUrl(avatarUrl), bannerUrl };
}

/**
 * Resolve a YouTube @handle. Accepts "@name", "name", or youtube.com/@name.
 * Rejects channel IDs (UC…) so linking always goes through a handle.
 */
export function parseYoutubeHandle(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  let handle = '';
  const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (urlMatch) {
    handle = urlMatch[1];
  } else if (raw.includes('youtube.com/') || raw.includes('youtu.be/')) {
    return null;
  } else if (raw.startsWith('@')) {
    handle = raw.slice(1).split(/[/?#\s]/)[0];
  } else if (/^[A-Za-z0-9._-]+$/.test(raw)) {
    handle = raw;
  }

  if (!handle || handle.length < 2 || handle.length > 60) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(handle)) return null;
  if (/^(UC|HC)[a-zA-Z0-9_-]{10,}$/.test(handle)) return null;
  return `@${handle}`;
}
