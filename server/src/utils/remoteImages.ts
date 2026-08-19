import fs from 'fs';
import path from 'path';
import { ASSETS_DIR, DOWNLOADS_DIR } from '../config.js';
import { ensureDir, resolveInside } from './paths.js';
import { db } from '../db/database.js';
import { isYouTubeVideoId, sanitizeAvatarUrl, youtubeThumbUrl } from './youtube.js';

const THUMBS_DIR = path.join(ASSETS_DIR, 'thumbs');
const AVATARS_DIR = path.join(ASSETS_DIR, 'avatars');
const BANNERS_DIR = path.join(ASSETS_DIR, 'banners');
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.youtube.com/',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

const thumbInflight = new Map<string, Promise<string | null>>();
const avatarInflight = new Map<string, Promise<string | null>>();
const bannerInflight = new Map<string, Promise<string | null>>();

const AVATAR_HOSTS = new Set([
  'yt3.ggpht.com',
  'yt3.googleusercontent.com',
  'lh3.googleusercontent.com',
  'i.ytimg.com',
  'img.youtube.com',
  'www.youtube.com',
  'youtube.com',
]);

export function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

export function isDummyYoutubeThumb(buf: Buffer): boolean {
  if (buf.length < 800) return true;
  const size = jpegDimensions(buf);
  if (size && size.width <= 120 && size.height <= 90) return true;
  return false;
}

export function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50) return true;
  return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
}

function extFor(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return '.jpg';
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow', signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!looksLikeImage(buf)) return null;
    return buf;
  } catch {
    return null;
  }
}

function cachedPath(dir: string, id: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const ext of ['.jpg', '.webp', '.png']) {
    const full = path.join(dir, `${id}${ext}`);
    if (fs.existsSync(full) && fs.statSync(full).size > 800) return full;
  }
  return null;
}

export function youtubeThumbCandidates(videoId: string): string[] {
  return [
    youtubeThumbUrl(videoId, 'maxresdefault'),
    youtubeThumbUrl(videoId, 'sddefault'),
    youtubeThumbUrl(videoId, 'hq720'),
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
    youtubeThumbUrl(videoId, 'hqdefault'),
    youtubeThumbUrl(videoId, 'mqdefault'),
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

export async function ensureYoutubeThumb(videoId: string): Promise<string | null> {
  if (!isYouTubeVideoId(videoId)) return null;
  ensureDir(THUMBS_DIR);
  const existing = cachedPath(THUMBS_DIR, videoId);
  if (existing) return existing;

  const pending = thumbInflight.get(videoId);
  if (pending) return pending;

  const work = (async () => {
    for (const url of youtubeThumbCandidates(videoId)) {
      const buf = await fetchImage(url);
      if (!buf || isDummyYoutubeThumb(buf)) continue;
      const dest = path.join(THUMBS_DIR, `${videoId}${extFor(buf)}`);
      fs.writeFileSync(dest, buf);
      return dest;
    }
    return null;
  })();

  thumbInflight.set(videoId, work);
  try {
    return await work;
  } finally {
    thumbInflight.delete(videoId);
  }
}

function isAllowedAvatarUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (AVATAR_HOSTS.has(host)) return true;
    return host.endsWith('.ggpht.com') || host.endsWith('.googleusercontent.com') || host.endsWith('.ytimg.com');
  } catch {
    return false;
  }
}

function safeCacheId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function localAvatarFile(url: string): string | null {
  const rel = url.startsWith('/media/assets/')
    ? { base: ASSETS_DIR, rest: url.slice('/media/assets/'.length) }
    : url.startsWith('/media/downloads/')
      ? { base: DOWNLOADS_DIR, rest: url.slice('/media/downloads/'.length) }
      : null;
  if (!rel) return null;
  const full = resolveInside(rel.base, rel.rest);
  if (full && fs.existsSync(full) && fs.statSync(full).size > 800) return full;
  return null;
}

async function ensureChannelImage(
  dir: string,
  inflight: Map<string, Promise<string | null>>,
  channelId: string,
  hintUrl: string,
  column: 'avatar_url' | 'banner_url',
  force = false,
): Promise<string | null> {
  const id = safeCacheId(channelId);
  if (!id) return null;
  ensureDir(dir);
  if (!force) {
    const existing = cachedPath(dir, id);
    if (existing) return existing;
  }

  const pending = inflight.get(id);
  if (pending && !force) return pending;

  const work = (async () => {
    let raw = '';
    try {
      const row = db.prepare(`SELECT ${column} as url FROM channels WHERE id = ?`).get(channelId) as { url?: string } | undefined;
      raw = row?.url || '';
    } catch (_) {}
    const sanitized = column === 'avatar_url' ? (sanitizeAvatarUrl(raw) || raw) : raw;
    const hintCap = hintUrl.length > 2000 ? '' : hintUrl;
    const hint = column === 'avatar_url' ? (sanitizeAvatarUrl(hintCap) || hintCap) : hintCap;

    if (!force) {
      const local = localAvatarFile(sanitized) || localAvatarFile(raw) || localAvatarFile(hint);
      if (local) return local;
    }

    const seen = new Set<string>();
    for (const candidate of [hint, sanitized, raw]) {
      if (!candidate || seen.has(candidate) || !isAllowedAvatarUrl(candidate)) continue;
      seen.add(candidate);
      const buf = await fetchImage(candidate);
      if (buf && buf.length > 800) {
        for (const ext of ['.jpg', '.webp', '.png']) {
          const prev = path.join(dir, `${id}${ext}`);
          if (fs.existsSync(prev)) {
            try { fs.unlinkSync(prev); } catch { /* ignore */ }
          }
        }
        const dest = path.join(dir, `${id}${extFor(buf)}`);
        fs.writeFileSync(dest, buf);
        return dest;
      }
    }
    return cachedPath(dir, id);
  })();

  inflight.set(id, work);
  try {
    return await work;
  } finally {
    inflight.delete(id);
  }
}

export async function ensureChannelAvatar(channelId: string, hintUrl = '', force = false): Promise<string | null> {
  return ensureChannelImage(AVATARS_DIR, avatarInflight, channelId, hintUrl, 'avatar_url', force);
}

export async function ensureChannelBanner(channelId: string, hintUrl = '', force = false): Promise<string | null> {
  return ensureChannelImage(BANNERS_DIR, bannerInflight, channelId, hintUrl, 'banner_url', force);
}

export async function materializeChannelBranding(
  channelId: string,
  avatarUrl = '',
  bannerUrl = '',
): Promise<{ avatarUrl: string; bannerUrl: string }> {
  const [avatarFile, bannerFile] = await Promise.all([
    ensureChannelAvatar(channelId, avatarUrl, true),
    ensureChannelBanner(channelId, bannerUrl, true),
  ]);
  return {
    avatarUrl: avatarFile ? `/media/avatar/${encodeURIComponent(channelId)}` : (avatarUrl || ''),
    bannerUrl: bannerFile ? `/media/banner/${encodeURIComponent(channelId)}` : (bannerUrl || ''),
  };
}

export function prefetchCatalogThumbs(videoIds: Array<string | undefined | null>) {
  const ids = [...new Set(videoIds.filter((id): id is string => !!id && isYouTubeVideoId(id)))].slice(0, SUB_FEED_THUMB_LIMIT);
  void Promise.allSettled(ids.map((id) => ensureYoutubeThumb(id)));
}

/** Search / one-off browsing. Protected feed files are not expired. */
export const IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Newest online videos per subscription kept in the image cache. */
export const SUB_FEED_THUMB_LIMIT = 80;
/** Newest online catalog rows per subscription kept in SQLite. */
export const SUB_FEED_VIDEO_LIMIT = 120;

export function cacheEntryId(filename: string): string | null {
  const m = filename.match(/^([a-zA-Z0-9_-]{1,64})\.(jpg|jpeg|webp|png)$/i);
  return m ? m[1] : null;
}

export function trimSubscribedChannelCatalog(limit = SUB_FEED_VIDEO_LIMIT): number {
  const subs = db.prepare('SELECT channel_id FROM subscriptions').all() as Array<{ channel_id: string }>;
  const del = db.prepare(`
    DELETE FROM videos
    WHERE id IN (
      SELECT id FROM (
        SELECT id FROM videos
        WHERE channel_id = ?
          AND is_downloaded = 0
          AND liked = 0
          AND IFNULL(watch_progress, 0) = 0
          AND last_watched_at IS NULL
          AND id NOT IN (
            SELECT id FROM (
              SELECT id FROM videos
              WHERE channel_id = ? AND is_downloaded = 0
              ORDER BY CASE WHEN upload_date IS NULL OR upload_date = '' THEN 0 ELSE 1 END DESC,
                       upload_date DESC, created_at DESC
              LIMIT ?
            )
          )
      )
    )
  `);
  let removed = 0;
  const tx = db.transaction(() => {
    for (const sub of subs) {
      if (!sub.channel_id) continue;
      removed += del.run(sub.channel_id, sub.channel_id, limit).changes;
    }
    db.prepare(`
      DELETE FROM content_locales
      WHERE entity_type = 'video'
        AND entity_id NOT IN (SELECT id FROM videos)
    `).run();
  });
  tx();
  return removed;
}

export function loadProtectedCacheIds(): { thumbs: Set<string>; avatars: Set<string> } {
  const thumbs = new Set<string>();
  const avatars = new Set<string>();

  const downloaded = db.prepare(`
    SELECT id, channel_id, local_thumbnail_path FROM videos WHERE is_downloaded = 1
  `).all() as Array<{ id: string; channel_id?: string; local_thumbnail_path?: string }>;
  for (const v of downloaded) {
    if (v.channel_id) avatars.add(safeCacheId(v.channel_id));
    if (v.id && !v.local_thumbnail_path) thumbs.add(v.id);
  }

  const subs = db.prepare('SELECT channel_id FROM subscriptions').all() as Array<{ channel_id: string }>;
  const feedStmt = db.prepare(`
    SELECT id FROM videos
    WHERE channel_id = ? AND is_downloaded = 0
    ORDER BY CASE WHEN upload_date IS NULL OR upload_date = '' THEN 0 ELSE 1 END DESC,
             upload_date DESC, created_at DESC
    LIMIT ?
  `);
  for (const sub of subs) {
    if (!sub.channel_id) continue;
    avatars.add(safeCacheId(sub.channel_id));
    const feed = feedStmt.all(sub.channel_id, SUB_FEED_THUMB_LIMIT) as Array<{ id: string }>;
    for (const v of feed) {
      if (v.id) thumbs.add(v.id);
    }
  }

  const owners = db.prepare('SELECT id, linked_youtube_id FROM channels WHERE is_owner = 1').all() as Array<{ id: string; linked_youtube_id?: string }>;
  for (const c of owners) {
    if (c.id) avatars.add(safeCacheId(c.id));
    if (c.linked_youtube_id) avatars.add(safeCacheId(c.linked_youtube_id));
  }

  return { thumbs, avatars };
}

export function pruneCacheDir(
  dir: string,
  keep: Set<string>,
  ttlMs = IMAGE_CACHE_TTL_MS,
  now = Date.now(),
): { deleted: number; kept: number } {
  let deleted = 0;
  let kept = 0;
  if (!fs.existsSync(dir)) return { deleted, kept };

  for (const name of fs.readdirSync(dir)) {
    const id = cacheEntryId(name);
    if (!id) continue;
    const full = path.join(dir, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (keep.has(id) || now - stat.mtimeMs < ttlMs) {
      kept += 1;
      continue;
    }
    try {
      fs.unlinkSync(full);
      deleted += 1;
    } catch {
      kept += 1;
    }
  }
  return { deleted, kept };
}

export function pruneRemoteImageCache(now = Date.now()): { deleted: number; kept: number; trimmed: number } {
  const trimmed = trimSubscribedChannelCatalog();
  const protectedIds = loadProtectedCacheIds();
  const thumbs = pruneCacheDir(THUMBS_DIR, protectedIds.thumbs, IMAGE_CACHE_TTL_MS, now);
  const avatars = pruneCacheDir(AVATARS_DIR, protectedIds.avatars, IMAGE_CACHE_TTL_MS, now);
  const banners = pruneCacheDir(BANNERS_DIR, protectedIds.avatars, IMAGE_CACHE_TTL_MS, now);
  return {
    deleted: thumbs.deleted + avatars.deleted + banners.deleted,
    kept: thumbs.kept + avatars.kept + banners.kept,
    trimmed,
  };
}
