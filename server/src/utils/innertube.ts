import { isYouTubeVideoId, sanitizeThumbUrl, youtubeThumbUrl } from './youtube.js';
import { saveContentLocale } from './contentLocale.js';
import { db } from '../db/database.js';

const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1';
const CLIENT_VERSION = '2.20260101.00.00';
const CLIENT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface OriginalVideoMeta {
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export function parsePlayerResponse(json: unknown): OriginalVideoMeta | null {
  const details = (json as { videoDetails?: Record<string, any> } | null)?.videoDetails;
  const title = String(details?.title || '').trim();
  if (!title) return null;
  const thumbs = Array.isArray(details?.thumbnail?.thumbnails) ? details.thumbnail.thumbnails : [];
  const last = thumbs.length ? thumbs[thumbs.length - 1] : null;
  return {
    title,
    description: String(details?.shortDescription || '').trim(),
    channelTitle: String(details?.author || '').trim(),
    thumbnailUrl: sanitizeThumbUrl(last?.url) || (details?.videoId && isYouTubeVideoId(details.videoId) ? youtubeThumbUrl(details.videoId) : ''),
  };
}

async function innertubePlayer(videoId: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(`${INNERTUBE_URL}/player?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': CLIENT_UA,
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': CLIENT_VERSION,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: CLIENT_VERSION,
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Innertube player failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOriginalVideoMeta(videoId: string): Promise<OriginalVideoMeta> {
  if (!isYouTubeVideoId(videoId)) throw new Error('Invalid video id');
  const parsed = parsePlayerResponse(await innertubePlayer(videoId));
  if (!parsed) throw new Error('No original title in player response');
  return parsed;
}

function hasPlayerLocale(videoId: string): boolean {
  try {
    const row = db.prepare(`
      SELECT 1 AS ok FROM content_locales
      WHERE entity_type = 'video' AND entity_id = ? AND lang = 'player'
    `).get(videoId) as { ok: number } | undefined;
    return !!row;
  } catch {
    return false;
  }
}

function persistOriginal(videoId: string, meta: OriginalVideoMeta): void {
  saveContentLocale('video', videoId, {
    title: meta.title,
    description: meta.description,
    channelTitle: meta.channelTitle,
  }, 'player');
  try {
    db.prepare(`
      UPDATE videos
      SET title = CASE WHEN is_downloaded = 1 THEN title ELSE ? END,
          thumbnail_url = COALESCE(NULLIF(?, ''), thumbnail_url),
          channel_title = COALESCE(NULLIF(?, ''), channel_title)
      WHERE id = ?
    `).run(meta.title, meta.thumbnailUrl, meta.channelTitle, videoId);
    db.prepare(`UPDATE recent_search_videos SET title = ? WHERE video_id = ?`).run(meta.title, videoId);
  } catch (_) {}
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (!items.length) return;
  let index = 0;
  const n = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: n }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }));
}

export async function hydrateOriginalVideos<T extends {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  channelTitle?: string;
  channel_title?: string;
}>(videos: T[], concurrency = 5): Promise<T[]> {
  const targets = videos.filter((v) => v.id && isYouTubeVideoId(v.id) && v.type !== 'channel');
  await mapPool(targets, concurrency, async (video) => {
    const id = video.id!;
    if (hasPlayerLocale(id)) {
      const loc = db.prepare(`
        SELECT title, description, channel_title FROM content_locales
        WHERE entity_type = 'video' AND entity_id = ? AND lang = 'player'
      `).get(id) as { title: string; description: string; channel_title: string } | undefined;
      if (loc?.title) {
        video.title = loc.title;
        if (loc.description) video.description = loc.description;
        if (loc.channel_title) {
          video.channelTitle = loc.channel_title;
          video.channel_title = loc.channel_title;
        }
      }
      return;
    }
    try {
      const meta = await fetchOriginalVideoMeta(id);
      persistOriginal(id, meta);
      video.title = meta.title;
      if (meta.description) video.description = meta.description;
      if (meta.channelTitle) {
        video.channelTitle = meta.channelTitle;
        video.channel_title = meta.channelTitle;
      }
      if (meta.thumbnailUrl) {
        video.thumbnailUrl = meta.thumbnailUrl;
        video.thumbnail_url = meta.thumbnailUrl;
      }
    } catch (err: any) {
      console.warn('hydrateOriginalVideos failed:', id, err.message);
    }
  });
  return videos;
}

function parseVideoCountText(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (typeof node.simpleText === 'string') return parseVideoCountText(node.simpleText);
    if (typeof node.content === 'string') return parseVideoCountText(node.content);
    if (Array.isArray(node.runs)) {
      return parseVideoCountText(node.runs.map((run: { text?: string }) => run?.text || '').join(''));
    }
    const label = (node.accessibility as { accessibilityData?: { label?: string } } | undefined)
      ?.accessibilityData?.label;
    if (label) return parseVideoCountText(label);
  }
  if (typeof value !== 'string') return 0;
  const text = value.replace(/\u00a0/g, ' ').trim();
  if (!/(vidéos?|vídeos?|videos?)/i.test(text)) return 0;

  const compact = text.match(/([\d]+(?:[.,][\d]+)?)\s*([kmb])\b/i);
  if (compact) {
    const amount = parseFloat(compact[1].replace(',', '.'));
    if (!Number.isFinite(amount)) return 0;
    const factor = compact[2].toLowerCase() === 'b' ? 1_000_000_000
      : compact[2].toLowerCase() === 'm' ? 1_000_000
        : 1_000;
    return Math.round(amount * factor);
  }

  const exact = text.match(/([\d][\d.\s,]*)/);
  if (!exact) return 0;
  const digits = exact[1].replace(/[.\s,]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function walkVideoCount(node: unknown, depth = 0): number {
  if (!node || depth > 24) return 0;
  if (typeof node === 'string') return parseVideoCountText(node);
  if (typeof node !== 'object') return 0;

  if (Array.isArray(node)) {
    let best = 0;
    for (const item of node) {
      const n = walkVideoCount(item, depth + 1);
      if (n > best) best = n;
    }
    return best;
  }

  const obj = node as Record<string, unknown>;
  let best = 0;
  for (const [key, val] of Object.entries(obj)) {
    if (/video[s]?_?count/i.test(key)) {
      const n = parseVideoCountText(val);
      if (n > best) best = n;
    }
  }
  for (const val of Object.values(obj)) {
    const n = walkVideoCount(val, depth + 1);
    if (n > best) best = n;
  }
  return best;
}

export function extractChannelVideoCount(json: unknown): number {
  const root = json as Record<string, unknown> | null;
  if (!root) return 0;
  const fromHeader = walkVideoCount(root.header);
  if (fromHeader > 0) return fromHeader;
  const fromMeta = Math.max(walkVideoCount(root.metadata), walkVideoCount(root.microformat));
  return fromMeta;
}

export function persistChannelVideoCount(channelId: string, count: number): void {
  if (!channelId || count <= 0) return;
  try {
    db.prepare(`
      UPDATE channels
      SET video_count = CASE WHEN ? > IFNULL(video_count, 0) THEN ? ELSE video_count END
      WHERE id = ?
    `).run(count, count, channelId);
  } catch (_) {}
}

function toChannelBrowseId(id: string): string {
  if (!id) return '';
  if (/^UC[A-Za-z0-9_-]{22}$/.test(id)) return id;
  if (/^UU[A-Za-z0-9_-]{22}$/.test(id)) return `UC${id.slice(2)}`;
  if (/^UULF[A-Za-z0-9_-]{22}$/.test(id)) return `UC${id.slice(4)}`;
  return id.startsWith('UC') ? id : '';
}

export async function fetchChannelVideoCount(channelId: string): Promise<number> {
  const browseId = toChannelBrowseId(channelId);
  if (!browseId) return 0;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(`${INNERTUBE_URL}/browse?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': CLIENT_UA,
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': CLIENT_VERSION,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: CLIENT_VERSION,
            hl: 'en',
            gl: 'US',
          },
        },
        browseId,
      }),
      signal: ac.signal,
    });
    if (!res.ok) return 0;
    return extractChannelVideoCount(await res.json());
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

const verifiedVideoCounts = new Set<string>();

export async function ensureChannelVideoCount(channelId: string, knownCount = 0): Promise<number> {
  if (!channelId || channelId.startsWith('custom_')) return knownCount;
  let stored = 0;
  try {
    const row = db.prepare('SELECT video_count FROM channels WHERE id = ?').get(channelId) as
      | { video_count?: number }
      | undefined;
    stored = Number(row?.video_count || 0);
  } catch {
    stored = 0;
  }

  if (verifiedVideoCounts.has(channelId) && stored > 0) return stored;

  // Catalog fetches cap at 50/100, so a stored total in that range is not trusted
  // until YouTube's channel header confirms it.
  const looksCapped = stored <= 0 || stored <= 200;
  if (!looksCapped) {
    verifiedVideoCounts.add(channelId);
    return stored;
  }

  const live = await fetchChannelVideoCount(channelId);
  if (live > 0) {
    persistChannelVideoCount(channelId, live);
    verifiedVideoCounts.add(channelId);
    return Math.max(live, stored);
  }
  return stored || knownCount;
}
