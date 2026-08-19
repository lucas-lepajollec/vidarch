import { db } from '../db/database.js';
import { sanitizeAvatarUrl, sanitizeThumbUrl } from './youtube.js';

export function saveContentLocale(
  entityType: 'video' | 'channel',
  entityId: string,
  fields: { title?: string | null; description?: string | null; channelTitle?: string | null },
  lang: 'original' | 'player' = 'original',
): void {
  if (!entityId || !fields.title?.trim()) return;
  try {
    db.prepare(`
      INSERT INTO content_locales (entity_type, entity_id, lang, title, description, channel_title, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(entity_type, entity_id, lang) DO UPDATE SET
        title = excluded.title,
        description = COALESCE(NULLIF(excluded.description, ''), content_locales.description),
        channel_title = COALESCE(NULLIF(excluded.channel_title, ''), content_locales.channel_title),
        updated_at = datetime('now')
    `).run(
      entityType,
      entityId,
      lang,
      fields.title.trim(),
      fields.description?.trim() || '',
      fields.channelTitle?.trim() || '',
    );
  } catch (err: any) {
    console.warn('saveContentLocale failed:', err.message);
  }
}

export function clearContentLocale(entityType: 'video' | 'channel', entityId: string): void {
  if (!entityId) return;
  try {
    db.prepare('DELETE FROM content_locales WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId);
  } catch (err: any) {
    console.warn('clearContentLocale failed:', err.message);
  }
}

function readLocale(entityType: 'video' | 'channel', entityId: string, lang: 'original' | 'player'): {
  title: string;
  description: string;
  channel_title: string;
} | undefined {
  try {
    return db.prepare(`
      SELECT title, description, channel_title
      FROM content_locales
      WHERE entity_type = ? AND entity_id = ? AND lang = ?
    `).get(entityType, entityId, lang) as any;
  } catch {
    return undefined;
  }
}

export function rememberFetchedVideo(video: {
  id?: string;
  title?: string;
  description?: string;
  channelTitle?: string;
  channel_title?: string;
  language?: string;
}): void {
  const id = video.id;
  if (!id) return;
  saveContentLocale('video', id, {
    title: video.title,
    description: video.description,
    channelTitle: video.channelTitle || video.channel_title,
  });
  if (video.language) {
    try {
      db.prepare(`
        UPDATE videos SET language = COALESCE(NULLIF(language, ''), ?)
        WHERE id = ?
      `).run(video.language, id);
    } catch (_) {}
  }
}

export function rememberFetchedChannel(channel: {
  id?: string;
  title?: string;
  description?: string;
  language?: string;
}): void {
  const id = channel.id;
  if (!id) return;
  saveContentLocale('channel', id, {
    title: channel.title,
    description: channel.description,
  });
  if (channel.language) {
    try {
      db.prepare(`
        UPDATE channels SET language = COALESCE(NULLIF(language, ''), ?)
        WHERE id = ?
      `).run(channel.language, id);
    } catch (_) {}
  }
}

export function applyVideoLocale<T extends Record<string, any>>(row: T | null | undefined): T | null | undefined {
  if (!row) return row;
  const id = row.id || row.video_id;
  const loc = id
    ? (readLocale('video', id, 'player') || (row.is_downloaded === 1 ? readLocale('video', id, 'original') : undefined))
    : undefined;
  const thumb = sanitizeThumbUrl(row.thumbnail_url || row.thumbnailUrl) || row.thumbnail_url || row.thumbnailUrl;
  const avatar = sanitizeAvatarUrl(row.channel_avatar || row.channelAvatar) || row.channel_avatar || row.channelAvatar;
  return {
    ...row,
    title: loc?.title || row.title,
    description: loc?.description || row.description,
    channel_title: loc?.channel_title || row.channel_title,
    channelTitle: loc?.channel_title || row.channelTitle || row.channel_title,
    thumbnail_url: thumb,
    thumbnailUrl: thumb,
    channel_avatar: avatar,
    channelAvatar: avatar,
  };
}

export function applyChannelLocale<T extends Record<string, any>>(row: T | null | undefined): T | null | undefined {
  if (!row) return row;
  const id = row.id || row.channelId || row.channel_id;
  if (!id) return row;
  const avatar = sanitizeAvatarUrl(row.avatar_url || row.avatarUrl) || row.avatar_url || row.avatarUrl;
  const isCustomUnlinked = String(id).startsWith('custom_') && !row.linked_youtube_id;
  if (isCustomUnlinked) {
    return {
      ...row,
      avatar_url: avatar,
      avatarUrl: avatar,
    };
  }
  const loc = readLocale('channel', id, 'original');
  return {
    ...row,
    title: loc?.title || row.title,
    description: loc?.description || row.description,
    avatar_url: avatar,
    avatarUrl: avatar,
  };
}

export function applyVideoLocales<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => applyVideoLocale(row) as T);
}

export function applyChannelLocales<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map((row) => applyChannelLocale(row) as T);
}
