import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { getChannelDetails, getChannelVideos } from '../services/ytdlp.js';

const router = Router();

// GET my primary owned channel
router.get('/my-channel', (req, res) => {
  try {
    const myChannel = db.prepare(`
      SELECT 
        c.*, 
        s.auto_download, 
        s.max_resolution, 
        s.last_scanned_at,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
      FROM channels c
      LEFT JOIN subscriptions s ON s.channel_id = c.id
      WHERE c.is_owner = 1
      ORDER BY c.updated_at DESC
      LIMIT 1
    `).get();

    res.json(myChannel || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all owned channels
router.get('/my-channels', (req, res) => {
  try {
    const channels = db.prepare(`
      SELECT 
        c.*, 
        s.auto_download, 
        s.max_resolution, 
        s.last_scanned_at,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
      FROM channels c
      LEFT JOIN subscriptions s ON s.channel_id = c.id
      WHERE c.is_owner = 1
      ORDER BY c.updated_at DESC
    `).all();

    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create custom personal channel
router.post('/create-my-channel', (req, res) => {
  const { title, handle, description = '', avatarUrl = '', bannerUrl = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le nom de la chaîne est requis' });
  }

  try {
    const channelId = `custom_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const channelTitle = title.trim();
    const handleClean = handle && handle.trim() 
      ? (handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`)
      : `@${channelTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    db.prepare(`
      INSERT INTO channels (
        id, title, handle, description, avatar_url, banner_url, subscriber_count, is_owner, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 'Chaîne Personnelle', 1, datetime('now'), datetime('now')
      )
    `).run(
      channelId,
      channelTitle,
      handleClean,
      description.trim(),
      avatarUrl.trim(),
      bannerUrl.trim()
    );

    // Auto-subscribe
    db.prepare(`
      INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at, created_at)
      VALUES (?, 0, datetime('now'), datetime('now'))
      ON CONFLICT(channel_id) DO NOTHING
    `).run(channelId);

    const created = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    res.json({ success: true, channel: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST claim existing YouTube channel as owner
router.post('/claim-my-channel', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'URL de chaîne requise' });
  }

  try {
    const details = await getChannelDetails(url.trim(), 0);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'Chaîne YouTube introuvable' });
    }

    db.prepare(`
      INSERT INTO channels (
        id, title, handle, description, avatar_url, banner_url, subscriber_count, video_count, is_owner, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        handle = excluded.handle,
        description = excluded.description,
        avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
        banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
        subscriber_count = excluded.subscriber_count,
        is_owner = 1,
        updated_at = datetime('now')
    `).run(
      details.id,
      details.title,
      details.handle || `@${details.title.replace(/\s+/g, '')}`,
      details.description || '',
      details.avatarUrl || '',
      details.bannerUrl || '',
      details.subscriberCount || '',
      details.videoCount || 0
    );

    // Subscribe
    db.prepare(`
      INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at, created_at)
      VALUES (?, 0, datetime('now'), datetime('now'))
      ON CONFLICT(channel_id) DO NOTHING
    `).run(details.id);

    // Save all channel videos
    if (details.videos && details.videos.length > 0) {
      const insertVideoStmt = db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, duration, duration_string,
          view_count, upload_date, thumbnail_url, is_downloaded, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          thumbnail_url = excluded.thumbnail_url,
          duration_string = excluded.duration_string,
          view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END
      `);

      for (const v of details.videos) {
        try {
          insertVideoStmt.run(
            v.id,
            details.id,
            details.title,
            v.title,
            v.duration,
            v.durationString,
            v.viewCount,
            v.uploadDate,
            v.thumbnailUrl
          );
        } catch (_) {}
      }
    }

    const claimed = db.prepare('SELECT * FROM channels WHERE id = ?').get(details.id);
    res.json({ success: true, channel: claimed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT customize channel (edit title, description, handle, avatar, banner)
router.put('/:id/customize', (req, res) => {
  const { id } = req.params;
  const { title, handle, description, avatarUrl, bannerUrl } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Chaîne introuvable' });
    }

    db.prepare(`
      UPDATE channels SET
        title = COALESCE(NULLIF(?, ''), title),
        handle = COALESCE(NULLIF(?, ''), handle),
        description = COALESCE(?, description),
        avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
        banner_url = COALESCE(NULLIF(?, ''), banner_url),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      handle ? (handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`) : null,
      description !== undefined ? description.trim() : null,
      avatarUrl !== undefined ? avatarUrl.trim() : null,
      bannerUrl !== undefined ? bannerUrl.trim() : null,
      id
    );

    const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    res.json({ success: true, channel: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST set channel as the active primary owned creator channel
router.post('/:id/set-active-owner', (req, res) => {
  const { id } = req.params;
  try {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (!channel) {
      return res.status(404).json({ error: 'Chaîne introuvable' });
    }

    db.prepare(`
      UPDATE channels 
      SET is_owner = 1, updated_at = datetime('now') 
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    res.json({ success: true, channel: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST unclaim channel (removes is_owner status from this channel)
router.post('/:id/unclaim', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare(`
      UPDATE channels 
      SET is_owner = 0, updated_at = datetime('now') 
      WHERE id = ?
    `).run(id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET all subscribed channels
router.get('/', (req, res) => {
  try {
    const channels = db.prepare(`
      SELECT 
        c.*, 
        s.auto_download, 
        s.max_resolution, 
        s.last_scanned_at,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
      FROM subscriptions s
      JOIN channels c ON s.channel_id = c.id
      ORDER BY c.title COLLATE NOCASE ASC
    `).all();

    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET more online videos for a channel (pagination / "Voir plus")
router.get('/:id/more-videos', async (req, res) => {
  const { id } = req.params;
  const offset = Math.max(0, parseInt(req.query.offset as string || '50', 10));
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '50', 10)), 100);

  try {
    const handleWithAt = id.startsWith('@') ? id : `@${id}`;
    const handleWithoutAt = id.replace(/^@/, '');

    const channel = db.prepare(`
      SELECT * FROM channels WHERE id = ? OR handle = ? OR handle = ?
    `).get(id, handleWithAt, handleWithoutAt) as any;

    const queryTarget = channel?.handle || channel?.id || id;
    const startIndex = offset + 1;

    const moreVideos = await getChannelVideos(queryTarget, startIndex, limit);
    const channelId = channel?.id || id;
    const channelTitle = channel?.title || 'Chaîne YouTube';
    const channelAvatar = channel?.avatar_url || '';

    const formattedVideos = moreVideos.map((v: any) => ({
      id: v.id,
      channel_id: channelId,
      channel_title: channelTitle,
      channel_avatar: channelAvatar,
      title: v.title,
      duration: v.duration || 0,
      duration_string: v.duration_string || v.durationString || '',
      upload_date: v.upload_date || v.uploadDate || '',
      view_count: v.view_count || v.viewCount || 0,
      thumbnail_url: v.thumbnail_url || v.thumbnailUrl,
      is_downloaded: 0,
      url: v.url,
    }));

    if (formattedVideos.length > 0) {
      const insertVideoStmt = db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, duration, duration_string,
          view_count, upload_date, thumbnail_url, is_downloaded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          title = COALESCE(NULLIF(excluded.title, ''), videos.title),
          thumbnail_url = COALESCE(NULLIF(excluded.thumbnail_url, ''), videos.thumbnail_url),
          duration_string = COALESCE(NULLIF(excluded.duration_string, ''), videos.duration_string),
          view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END
      `);

      for (const v of formattedVideos) {
        try {
          insertVideoStmt.run(
            v.id,
            channelId,
            channelTitle,
            v.title,
            v.duration || 0,
            v.duration_string || '',
            v.view_count || 0,
            v.upload_date || '',
            v.thumbnail_url
          );
        } catch (_) {}
      }
    }

    res.json({
      videos: formattedVideos,
      count: formattedVideos.length,
      hasMore: formattedVideos.length === limit,
    });
  } catch (err: any) {
    console.error('Error fetching more videos:', err);
    res.status(500).json({ error: err.message, videos: [] });
  }
});

// GET single channel details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const handleWithAt = id.startsWith('@') ? id : `@${id}`;
    const handleWithoutAt = id.replace(/^@/, '');

    let channel = db.prepare(`
      SELECT c.*, s.auto_download, s.max_resolution, s.last_scanned_at,
             CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
      FROM channels c
      LEFT JOIN subscriptions s ON c.id = s.channel_id
      WHERE c.id = ? OR c.handle = ? OR c.handle = ?
    `).get(id, handleWithAt, handleWithoutAt) as any;

    // Fetch downloaded videos of this channel
    let downloadedVideos = channel ? db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE (v.channel_id = ? OR v.channel_id = ?) AND v.is_downloaded = 1 
      ORDER BY v.upload_date DESC, v.created_at DESC
    `).all(channel.id, channel.handle || '') : [];

    // Fetch online detected videos of this channel
    let detectedVideos = channel ? db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE (v.channel_id = ? OR v.channel_id = ?) AND v.is_downloaded = 0 
      ORDER BY v.upload_date DESC, v.created_at DESC
    `).all(channel.id, channel.handle || '') : [];

    // If channel is missing in DB or has missing banner/avatar or has 0 videos, fetch LIVE synchronously
    if (!channel || !channel.avatar_url || (detectedVideos.length === 0 && downloadedVideos.length === 0)) {
      try {
        const liveQuery = channel?.handle || channel?.id || id;
        const liveDetails = await getChannelDetails(liveQuery, 50);

        if (liveDetails && liveDetails.id) {
          const effectiveId = liveDetails.id;
          const sub = db.prepare('SELECT * FROM subscriptions WHERE channel_id = ? OR channel_id = ?').get(effectiveId, channel?.id || '');

          db.prepare(`
            INSERT INTO channels (
              id, title, handle, description, avatar_url, banner_url, subscriber_count, video_count, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
              title = COALESCE(NULLIF(excluded.title, ''), channels.title),
              avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
              banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
              description = COALESCE(NULLIF(excluded.description, ''), channels.description),
              subscriber_count = COALESCE(NULLIF(excluded.subscriber_count, ''), channels.subscriber_count),
              handle = COALESCE(NULLIF(excluded.handle, ''), channels.handle),
              updated_at = datetime('now')
          `).run(
            effectiveId,
            liveDetails.title,
            liveDetails.handle || channel?.handle || '',
            liveDetails.description || channel?.description || '',
            liveDetails.avatarUrl || channel?.avatar_url || '',
            liveDetails.bannerUrl || channel?.banner_url || '',
            liveDetails.subscriberCount || channel?.subscriber_count || '',
            liveDetails.videoCount || 0
          );

          // Save live videos into videos table
          if (liveDetails.videos && liveDetails.videos.length > 0) {
            const insertVideoStmt = db.prepare(`
              INSERT INTO videos (
                id, channel_id, channel_title, title, duration, duration_string,
                view_count, upload_date, thumbnail_url, is_downloaded
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              ON CONFLICT(id) DO UPDATE SET
                title = COALESCE(NULLIF(excluded.title, ''), videos.title),
                thumbnail_url = COALESCE(NULLIF(excluded.thumbnail_url, ''), videos.thumbnail_url),
                duration_string = COALESCE(NULLIF(excluded.duration_string, ''), videos.duration_string),
                view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END
            `);

            for (const v of liveDetails.videos) {
              try {
                insertVideoStmt.run(
                  v.id,
                  effectiveId,
                  liveDetails.title,
                  v.title,
                  v.duration || 0,
                  v.durationString || '',
                  v.viewCount || 0,
                  v.uploadDate || '',
                  v.thumbnailUrl
                );
              } catch (_) {}
            }
          }

          // Reload channel record
          channel = db.prepare(`
            SELECT c.*, s.auto_download, s.max_resolution, s.last_scanned_at,
                   CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
            FROM channels c
            LEFT JOIN subscriptions s ON c.id = s.channel_id
            WHERE c.id = ?
          `).get(effectiveId) as any;

          // Reload videos
          downloadedVideos = db.prepare(`
            SELECT v.*, c.avatar_url as channel_avatar
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            WHERE (v.channel_id = ? OR v.channel_id = ?) AND v.is_downloaded = 1 
            ORDER BY v.upload_date DESC, v.created_at DESC
          `).all(effectiveId, channel?.handle || '');

          detectedVideos = db.prepare(`
            SELECT v.*, c.avatar_url as channel_avatar
            FROM videos v
            LEFT JOIN channels c ON v.channel_id = c.id
            WHERE (v.channel_id = ? OR v.channel_id = ?) AND v.is_downloaded = 0 
            ORDER BY v.upload_date DESC, v.created_at DESC
          `).all(effectiveId, channel?.handle || '');
        }
      } catch (err: any) {
        console.error('Error fetching live channel:', err.message);
      }
    }

    if (!channel) {
      return res.status(404).json({ error: 'Chaîne introuvable sur YouTube' });
    }

    res.json({
      channel,
      downloadedVideos,
      detectedVideos,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST subscribe to channel (by URL, ID or handle)
router.post('/subscribe', async (req, res) => {
  const { url, autoDownload = 0, maxResolution = '1080p' } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL ou identifiant de chaîne requis' });
  }

  try {
    // When subscribing, fetch all available videos of the channel without limit
    const details = await getChannelDetails(url, 0);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'Impossible de trouver la chaîne' });
    }

    // 1. Insert or update channel in DB
    db.prepare(`
      INSERT INTO channels (
        id, title, handle, description, avatar_url, banner_url, subscriber_count, video_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        handle = excluded.handle,
        description = excluded.description,
        avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
        banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
        subscriber_count = excluded.subscriber_count,
        video_count = excluded.video_count,
        updated_at = datetime('now')
    `).run(
      details.id,
      details.title,
      details.handle,
      details.description,
      details.avatarUrl,
      details.bannerUrl,
      details.subscriberCount,
      details.videoCount
    );

    // 2. Insert subscription
    db.prepare(`
      INSERT INTO subscriptions (channel_id, auto_download, max_resolution, last_scanned_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(channel_id) DO UPDATE SET
        auto_download = excluded.auto_download,
        max_resolution = excluded.max_resolution,
        last_scanned_at = datetime('now')
    `).run(details.id, autoDownload ? 1 : 0, maxResolution);

    // 3. Insert all available videos from channel into DB
    if (details.videos && details.videos.length > 0) {
      const insertVideo = db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, duration, duration_string,
          upload_date, thumbnail_url, view_count, is_downloaded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          thumbnail_url = excluded.thumbnail_url,
          duration_string = excluded.duration_string,
          view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END
      `);

      for (const v of details.videos) {
        try {
          insertVideo.run(
            v.id,
            details.id,
            details.title,
            v.title,
            v.duration,
            v.durationString,
            v.uploadDate,
            v.thumbnailUrl,
            v.viewCount || 0
          );
        } catch (_) {}
      }
    }

    res.json({
      success: true,
      channel: details,
      message: `Abonné à ${details.title}`,
    });
  } catch (err: any) {
    console.error('Subscription error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to unsubscribe a channel
function doUnsubscribe(id: string) {
  const handleWithAt = id.startsWith('@') ? id : `@${id}`;
  const handleWithoutAt = id.replace(/^@/, '');

  const ch = db.prepare('SELECT id FROM channels WHERE id = ? OR handle = ? OR handle = ?').get(id, handleWithAt, handleWithoutAt) as any;
  const targetId = ch?.id || id;

  db.prepare('DELETE FROM subscriptions WHERE channel_id = ?').run(targetId);
  db.prepare('DELETE FROM videos WHERE channel_id = ? AND is_downloaded = 0').run(targetId);
}

// POST unsubscribe to channel (support both /:id/unsubscribe and POST body)
router.post('/:id/unsubscribe', (req, res) => {
  const { id } = req.params;
  try {
    doUnsubscribe(id);
    res.json({ success: true, message: 'Désabonné avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unsubscribe', (req, res) => {
  const channelId = req.body.channelId || req.body.id;
  if (!channelId) return res.status(400).json({ error: 'channelId requis' });
  try {
    doUnsubscribe(channelId);
    res.json({ success: true, message: 'Désabonné avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE unsubscribe from channel
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    doUnsubscribe(id);
    res.json({ success: true, message: 'Désabonné avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update channel settings (auto-download, max resolution)
router.put('/:id/settings', (req, res) => {
  const { id } = req.params;
  const { auto_download, max_resolution, download_shorts } = req.body;

  try {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE channel_id = ?').get(id) as any;
    if (!sub) {
      return res.status(404).json({ error: 'Abonnement introuvable' });
    }

    db.prepare(`
      UPDATE subscriptions SET
        auto_download = COALESCE(?, auto_download),
        max_resolution = COALESCE(?, max_resolution),
        download_shorts = COALESCE(?, download_shorts)
      WHERE channel_id = ?
    `).run(
      auto_download !== undefined ? (auto_download ? 1 : 0) : null,
      max_resolution !== undefined ? max_resolution : null,
      download_shorts !== undefined ? (download_shorts ? 1 : 0) : null,
      id
    );

    res.json({ success: true, message: 'Paramètres mis à jour' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
