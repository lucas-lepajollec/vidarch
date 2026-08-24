import { Router } from 'express';
import { db } from '../db/database.js';
import { searchYouTube, getChannelDetails } from '../services/ytdlp.js';
import { isAllowedYouTubeTarget, looksLikeUrl } from '../utils/youtube.js';
import { isLocalOnly } from '../utils/settings.js';
import { applyChannelLocales, applyVideoLocales } from '../utils/contentLocale.js';

const router = Router();
const MAX_REMOTE_RESULTS = 50;

router.get('/', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const type = (req.query.type as string || 'all').toLowerCase();
  const offset = Math.max(0, parseInt(req.query.offset as string || '0', 10));
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '15', 10)), 50);

  if (!query) {
    return res.json({ channels: [], localVideos: [], youtubeVideos: [] });
  }

  if (looksLikeUrl(query) && !isAllowedYouTubeTarget(query)) {
    return res.status(400).json({ error: 'Seuls les liens YouTube sont acceptés.', channels: [], localVideos: [], youtubeVideos: [] });
  }

  try {
    const searchPattern = `%${query.replace(/[%_]/g, ' ')}%`;

    let localVideos: any[] = [];
    let localChannels: any[] = [];

    if (offset === 0 && (type === 'all' || type === 'local')) {
      localVideos = db.prepare(`
        SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle
        FROM videos v
        LEFT JOIN channels c ON v.channel_id = c.id
        WHERE v.is_downloaded = 1 
          AND (v.title LIKE ? OR v.description LIKE ? OR v.channel_title LIKE ? COLLATE NOCASE)
        ORDER BY v.downloaded_at DESC, v.created_at DESC 
        LIMIT 20
      `).all(searchPattern, searchPattern, searchPattern);

      localChannels = db.prepare(`
        SELECT c.*, 
               (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
               CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
        FROM channels c
        LEFT JOIN subscriptions s ON c.id = s.channel_id
        WHERE c.title LIKE ? OR c.handle LIKE ? COLLATE NOCASE
        LIMIT 5
      `).all(searchPattern, searchPattern);
    }

    let youtubeResults: any[] = [];
    // Fetch a small buffer for channel entities and already-downloaded videos,
    // while keeping one hard upper bound for yt-dlp and the response cache.
    const totalFetchCount = Math.min(offset + limit + 10, MAX_REMOTE_RESULTS);
    const localOnly = isLocalOnly();
    const wantRemote = !localOnly && (type === 'all' || type === 'youtube');

    if (wantRemote) {
      youtubeResults = await searchYouTube(query, totalFetchCount);
    }

    const channelsMap = new Map<string, any>();

    for (const lc of localChannels) {
      channelsMap.set(lc.id, {
        id: lc.id,
        title: lc.title,
        handle: lc.handle || '',
        avatarUrl: lc.avatar_url || '',
        bannerUrl: lc.banner_url || '',
        subscriberCount: lc.subscriber_count || '',
        description: lc.description || '',
        downloadedCount: lc.downloaded_count || 0,
        isSubscribed: lc.is_subscribed === 1,
        language: lc.language || '',
        url: `https://www.youtube.com/channel/${lc.id}`,
      });
    }

    const downloadedVideoIds = new Set<string>(localVideos.map((v) => v.id));
    const rawYoutubeVideos: any[] = [];
    const downloadedLookup = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle 
      FROM videos v 
      LEFT JOIN channels c ON v.channel_id = c.id 
      WHERE v.id = ? AND v.is_downloaded = 1
    `);
    const channelAvatarLookup = db.prepare('SELECT avatar_url, handle FROM channels WHERE id = ?');

    for (const item of youtubeResults) {
      const isChannelEntity =
        item.type === 'channel' ||
        (item.url && (item.url.includes('/channel/') || item.url.includes('/@') || item.url.includes('/user/'))) ||
        (item.id && (String(item.id).startsWith('UC') || String(item.id).startsWith('HC') || String(item.id).startsWith('@')));

      if (isChannelEntity) {
        const id = item.channelId || item.id;
        if (id && !channelsMap.has(id)) {
          const cached = channelAvatarLookup.get(id) as any;
          channelsMap.set(id, {
            id,
            title: item.title || item.channelTitle,
            handle: item.id?.startsWith('@') ? item.id : (item.channelId?.startsWith('@') ? item.channelId : `@${String(item.title || item.channelTitle || '').replace(/\s+/g, '')}`),
            avatarUrl: item.avatarUrl || cached?.avatar_url || item.thumbnailUrl || '',
            description: item.description || '',
            subscriberCount: item.viewCount ? `${item.viewCount} abonnés` : '',
            language: item.language || '',
            url: item.url || `https://www.youtube.com/channel/${id}`,
          });
        }
      } else {
        if (!item.id || String(item.id).length < 5) continue;

        const localMatch = downloadedLookup.get(item.id) as any;
        if (localMatch) {
          if (!downloadedVideoIds.has(item.id)) {
            localVideos.push(localMatch);
            downloadedVideoIds.add(item.id);
          }
        } else {
          if (item.channelId) {
            const chDb = channelAvatarLookup.get(item.channelId) as any;
            if (chDb?.avatar_url) {
              item.channelAvatar = chDb.avatar_url;
            }
          }
          rawYoutubeVideos.push(item);
        }
      }
    }

    const youtubeVideos = offset > 0 ? rawYoutubeVideos.slice(offset, offset + limit) : rawYoutubeVideos.slice(0, limit);

    if (offset === 0 && !localOnly) {
      try {
        const queryId = Buffer.from(query.toLowerCase()).toString('base64').replace(/=/g, '').slice(0, 64);
        db.prepare(`
          INSERT INTO search_history (id, query, result_count, searched_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(query) DO UPDATE SET
            searched_at = datetime('now'),
            result_count = excluded.result_count
        `).run(queryId, query, localVideos.length + youtubeVideos.length);
      } catch (_) {}

      const insertRecent = db.prepare(`
        INSERT INTO recent_search_videos (
          id, video_id, title, channel_title, channel_id, duration, duration_string,
          thumbnail_url, view_count, upload_date, url, description, language, searched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET searched_at = datetime('now')
      `);
      for (const yv of youtubeVideos.slice(0, 10)) {
        if (!yv.id) continue;
        try {
          insertRecent.run(
            yv.id,
            yv.id,
            yv.title || 'Vidéo',
            yv.channelTitle || '',
            yv.channelId || '',
            yv.duration || 0,
            yv.durationString || '',
            yv.thumbnailUrl || '',
            yv.viewCount || 0,
            yv.uploadDate || '',
            yv.url || '',
            yv.description || '',
            yv.language || ''
          );
        } catch (_) {}
      }
    }

    if (!localOnly && offset === 0 && query.startsWith('@')) {
      const existingCh = Array.from(channelsMap.values()).find((c) => c.handle === query || c.id === query);
      if (!existingCh || !existingCh.avatarUrl) {
        try {
          const ch = await getChannelDetails(query, 8);
          if (ch && ch.id) {
            const sub = db.prepare('SELECT 1 FROM subscriptions WHERE channel_id = ?').get(ch.id);
            channelsMap.set(ch.id, {
              id: ch.id,
              title: ch.title,
              handle: ch.handle || `@${ch.title.replace(/\s+/g, '')}`,
              avatarUrl: ch.avatarUrl || '',
              bannerUrl: ch.bannerUrl || '',
              description: ch.description || '',
              subscriberCount: ch.subscriberCount || '',
              videoCount: ch.videoCount || 0,
              isSubscribed: !!sub,
              url: `https://www.youtube.com/channel/${ch.id}`,
            });
            db.prepare(`
              INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET
                avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
                banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
                handle = COALESCE(NULLIF(excluded.handle, ''), channels.handle),
                updated_at = datetime('now')
            `).run(ch.id, ch.title, ch.handle || '', ch.description || '', ch.avatarUrl || '', ch.bannerUrl || '', ch.subscriberCount || '');

            for (const yv of youtubeVideos) {
              if (yv.channelId === ch.id) yv.channelAvatar = ch.avatarUrl;
            }
          }
        } catch (_) {}
      }
    }

    const uniqueChannelIds = localOnly
      ? []
      : Array.from(new Set(youtubeVideos.map((v) => v.channelId).filter(Boolean))).slice(0, 3);
    await Promise.allSettled(uniqueChannelIds.map(async (chId) => {
      let chDb = channelAvatarLookup.get(chId) as any;
      if (chDb?.avatar_url) {
        for (const v of youtubeVideos) {
          if (v.channelId === chId) v.channelAvatar = chDb.avatar_url;
        }
        return;
      }
      try {
        const details = await getChannelDetails(chId, 1);
        if (details?.avatarUrl) {
          db.prepare(`
            INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
              banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
              updated_at = datetime('now')
          `).run(details.id, details.title, details.handle || '', details.description || '', details.avatarUrl, details.bannerUrl || '', details.subscriberCount || '');
          for (const v of youtubeVideos) {
            if (v.channelId === chId) v.channelAvatar = details.avatarUrl;
          }
        }
      } catch (_) {}
    }));

    for (const yv of youtubeVideos) {
      if (!yv.channelAvatar && yv.channelId && channelsMap.has(yv.channelId)) {
        yv.channelAvatar = channelsMap.get(yv.channelId)?.avatarUrl;
      }
    }

    res.json({
      channels: applyChannelLocales(Array.from(channelsMap.values())),
      localVideos: applyVideoLocales(localVideos as any[]),
      youtubeVideos: applyVideoLocales(youtubeVideos as any[]),
      count: youtubeVideos.length,
      hasMore:
        offset + limit < MAX_REMOTE_RESULTS
        && (rawYoutubeVideos.length > offset + limit || youtubeResults.length >= totalFetchCount),
    });
  } catch (err: any) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
