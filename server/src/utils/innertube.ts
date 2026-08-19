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
