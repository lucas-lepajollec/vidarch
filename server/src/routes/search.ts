import { Router } from 'express';
import { db } from '../db/database.js';
import { searchYouTube, getChannelDetails, getVideoDetails } from '../services/ytdlp.js';

const router = Router();

router.get('/', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const type = (req.query.type as string || 'all').toLowerCase(); // 'all', 'local', 'youtube'
  const offset = Math.max(0, parseInt(req.query.offset as string || '0', 10));
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '15', 10)), 50);

  if (!query) {
    return res.json({ channels: [], localVideos: [], youtubeVideos: [] });
  }

  try {
    const searchPattern = `%${query}%`;

    // 1. Search local DB ONLY for videos that are actually downloaded (is_downloaded = 1)
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

    // 2. Search live YouTube
    let youtubeResults: any[] = [];
    const totalFetchCount = Math.min(offset + limit, 45);

    if (type === 'all' || type === 'youtube') {
      youtubeResults = await searchYouTube(query, totalFetchCount);
    }

    // 3. Separate Channels and Videos
    const channelsMap = new Map<string, any>();

    // Add local channels first
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
        url: `https://www.youtube.com/channel/${lc.id}`,
      });
    }

    // Set of local downloaded IDs to prevent duplicates in youtubeVideos
    const downloadedVideoIds = new Set<string>(localVideos.map(v => v.id));

    // Check YouTube results for explicit channel types and valid videos
    let rawYoutubeVideos: any[] = [];
    for (const item of youtubeResults) {
      const isChannelEntity = 
        item.type === 'channel' || 
        (item.url && (item.url.includes('/channel/') || item.url.includes('/@') || item.url.includes('/user/'))) ||
        (item.id && (item.id.startsWith('UC') || item.id.startsWith('HC') || item.id.startsWith('@'))) ||
        (!item.duration && !item.thumbnailUrl && item.channelTitle === item.title);

      if (isChannelEntity) {
        const id = item.channelId || item.id;
        if (id && !channelsMap.has(id)) {
          channelsMap.set(id, {
            id,
            title: item.title || item.channelTitle,
            handle: item.id?.startsWith('@') ? item.id : (item.channelId?.startsWith('@') ? item.channelId : `@${(item.title || item.channelTitle).replace(/\s+/g, '')}`),
            avatarUrl: item.avatarUrl || item.thumbnailUrl || '',
            description: item.description || '',
            subscriberCount: item.viewCount ? `${item.viewCount} abonnés` : '',
            url: item.url || `https://www.youtube.com/channel/${id}`,
          });
        }
      } else {
        // Skip invalid non-video entries
        if (!item.id || item.id.length < 5) continue;

        // Check if this video is already downloaded in local SQLite DB
        const localMatch = db.prepare(`
          SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle 
          FROM videos v 
          LEFT JOIN channels c ON v.channel_id = c.id 
          WHERE v.id = ? AND v.is_downloaded = 1
        `).get(item.id) as any;

        if (localMatch) {
          if (!downloadedVideoIds.has(item.id)) {
            localVideos.push(localMatch);
            downloadedVideoIds.add(item.id);
          }
        } else {
          // Check if channel avatar is cached in DB
          if (item.channelId) {
            const chDb = db.prepare('SELECT avatar_url, handle FROM channels WHERE id = ?').get(item.channelId) as any;
            if (chDb?.avatar_url) {
              item.channelAvatar = chDb.avatar_url;
            }
          }

          rawYoutubeVideos.push(item);
        }
      }
    }

    // Apply offset/limit slicing
    const youtubeVideos = offset > 0 ? rawYoutubeVideos.slice(offset, offset + limit) : rawYoutubeVideos.slice(0, limit);

    // 4. Record search query in search_history table
    if (offset === 0) {
      try {
        const queryId = Buffer.from(query.toLowerCase()).toString('base64').replace(/=/g, '');
        db.prepare(`
          INSERT INTO search_history (id, query, result_count, searched_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(query) DO UPDATE SET
            searched_at = datetime('now'),
            result_count = excluded.result_count
        `).run(queryId, query, (localVideos.length + youtubeVideos.length));
      } catch (_) {}
    }

    // 5. Intelligent Channel Detection from Search Query (only for initial search)
    if (offset === 0) {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 2);

      let candidateChannelId: string | null = null;
      if (query.startsWith('@')) {
        candidateChannelId = query;
      } else {
        const allResults = [...localVideos, ...youtubeVideos];
        for (const res of allResults) {
          const chTitle = (res.channel_title || res.channelTitle || '').toLowerCase();
          if (chTitle) {
            if (queryWords.some(w => w === chTitle) || queryLower.startsWith(chTitle) || chTitle === queryLower || queryLower.includes(chTitle)) {
              candidateChannelId = res.channel_id || res.channelId;
              break;
            }
          }
        }

        if (!candidateChannelId) {
          if (channelsMap.size > 0) {
            candidateChannelId = Array.from(channelsMap.keys())[0];
          } else if (queryWords.length <= 2 && allResults[0]?.channelId) {
            candidateChannelId = allResults[0].channelId;
          }
        }
      }

      // Fetch candidate channel details synchronously if needed
      if (candidateChannelId) {
        const existingCh = channelsMap.get(candidateChannelId);
        if (!existingCh || !existingCh.avatarUrl) {
          try {
            const ch = await getChannelDetails(candidateChannelId);
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

              if (ch.videos && Array.isArray(ch.videos)) {
                for (const cv of ch.videos) {
                  const matching = youtubeVideos.find(y => y.id === cv.id);
                  if (matching) {
                    if (cv.viewCount) matching.viewCount = cv.viewCount;
                    if (cv.title) matching.title = cv.title;
                    matching.channelAvatar = ch.avatarUrl;
                  }
                }
              }

              db.prepare(`
                INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                  avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
                  banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
                  handle = COALESCE(NULLIF(excluded.handle, ''), channels.handle),
                  description = COALESCE(NULLIF(excluded.description, ''), channels.description),
                  subscriber_count = COALESCE(NULLIF(excluded.subscriber_count, ''), channels.subscriber_count),
                  updated_at = datetime('now')
              `).run(
                ch.id,
                ch.title,
                ch.handle || '',
                ch.description || '',
                ch.avatarUrl || '',
                ch.bannerUrl || '',
                ch.subscriberCount || ''
              );
            }
          } catch (_) {}
        }
      }
    }

    // Resolve avatars for unique channels
    const uniqueChannelIds = Array.from(new Set(youtubeVideos.map(v => v.channelId).filter(Boolean))).slice(0, 6);
    await Promise.allSettled(uniqueChannelIds.map(async (chId) => {
      let chDb = db.prepare('SELECT avatar_url, handle FROM channels WHERE id = ?').get(chId) as any;
      if (!chDb?.avatar_url) {
        try {
          const details = await getChannelDetails(chId);
          if (details?.avatarUrl) {
            db.prepare(`
              INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET
                avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
                banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
                updated_at = datetime('now')
            `).run(details.id, details.title, details.handle || '', details.description || '', details.avatarUrl, details.bannerUrl || '', details.subscriberCount || '');
            chDb = { avatar_url: details.avatarUrl };

            if (details.videos && Array.isArray(details.videos)) {
              for (const cv of details.videos) {
                const matching = youtubeVideos.find(y => y.id === cv.id);
                if (matching) {
                  if (cv.viewCount) matching.viewCount = cv.viewCount;
                  if (cv.title) matching.title = cv.title;
                }
              }
            }
          }
        } catch (_) {}
      }

      if (chDb?.avatar_url) {
        for (const v of youtubeVideos) {
          if (v.channelId === chId) {
            v.channelAvatar = chDb.avatar_url;
          }
        }
      }
    }));

    // Resolve exact view counts for any videos with suspicious low view counts (< 1000)
    const lowViewVideos = youtubeVideos.filter(v => (!v.viewCount || v.viewCount < 1000) && v.id);
    if (lowViewVideos.length > 0) {
      await Promise.allSettled(lowViewVideos.map(async (v) => {
        try {
          const detail = await getVideoDetails(v.id);
          if (detail && detail.viewCount && detail.viewCount > (v.viewCount || 0)) {
            v.viewCount = detail.viewCount;
          }
        } catch (_) {}
      }));
    }

    // Backfill from DB for any known videos
    for (const yv of youtubeVideos) {
      const dbV = db.prepare('SELECT view_count, title FROM videos WHERE id = ?').get(yv.id) as any;
      if (dbV) {
        if (dbV.view_count && dbV.view_count > (yv.viewCount || 0)) yv.viewCount = dbV.view_count;
        if (dbV.title) yv.title = dbV.title;
      }
      if (!yv.channelAvatar && yv.channelId && channelsMap.has(yv.channelId)) {
        yv.channelAvatar = channelsMap.get(yv.channelId)?.avatarUrl;
      }
    }

    const channels = Array.from(channelsMap.values());

    res.json({
      channels,
      localVideos,
      youtubeVideos,
      count: youtubeVideos.length,
      hasMore: rawYoutubeVideos.length > (offset + limit),
    });
  } catch (err: any) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
