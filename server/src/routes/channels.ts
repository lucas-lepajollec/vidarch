import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { getChannelDetails, getChannelVideos } from '../services/ytdlp.js';
import { persistImageInput } from '../utils/assets.js';
import { ensureChannelVideoCount, hydrateOriginalVideos } from '../utils/innertube.js';
import { parseYoutubeHandle, sanitizeAvatarUrl } from '../utils/youtube.js';
import { isLocalOnly } from '../utils/settings.js';
import { downloadQueue } from '../services/queue.js';
import { applyChannelLocale, applyChannelLocales, applyVideoLocales, clearContentLocale, saveContentLocale } from '../utils/contentLocale.js';
import { materializeChannelBranding, prefetchCatalogThumbs } from '../utils/remoteImages.js';

const router = Router();

const DEFAULT_OWNER_TITLE = 'My channel';

interface OwnerBranding {
  title: string;
  handle: string;
  description: string;
  avatar_url: string;
  banner_url: string;
}

function ownerSelectSql() {
  return `
    SELECT 
      c.*, 
      s.auto_download,
      COALESCE(s.auto_download_mode, 'future') as auto_download_mode,
      s.max_resolution, 
      s.last_scanned_at,
      (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
      (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
    FROM channels c
    LEFT JOIN subscriptions s ON s.channel_id = c.id
  `;
}

function brandingFromChannel(ch: any): OwnerBranding {
  return {
    title: ch?.title || '',
    handle: ch?.handle || '',
    description: ch?.description || '',
    avatar_url: ch?.avatar_url || '',
    banner_url: ch?.banner_url || '',
  };
}

function brandingFromDetails(details: any, images?: { avatarUrl?: string; bannerUrl?: string }): OwnerBranding {
  return {
    title: details?.title || '',
    handle: details?.handle || '',
    description: details?.description || '',
    avatar_url: images?.avatarUrl || details?.avatarUrl || details?.avatar_url || '',
    banner_url: images?.bannerUrl || details?.bannerUrl || details?.banner_url || '',
  };
}

function emptyManualBranding(): OwnerBranding {
  return {
    title: DEFAULT_OWNER_TITLE,
    handle: '',
    description: '',
    avatar_url: '',
    banner_url: '',
  };
}

function setOriginBranding(channelId: string, branding: OwnerBranding) {
  db.prepare(`UPDATE channels SET origin_branding = ? WHERE id = ?`).run(JSON.stringify(branding), channelId);
}

function ensureOriginBranding(channelId: string, branding: OwnerBranding) {
  db.prepare(`
    UPDATE channels
    SET origin_branding = COALESCE(NULLIF(origin_branding, ''), ?)
    WHERE id = ?
  `).run(JSON.stringify(branding), channelId);
}

function originBrandingFor(channel: any): OwnerBranding {
  try {
    if (channel?.origin_branding) {
      return { ...emptyManualBranding(), ...JSON.parse(channel.origin_branding) };
    }
  } catch (_) {}
  if (channel?.linked_youtube_id) {
    const yt = db.prepare('SELECT * FROM channels WHERE id = ?').get(channel.linked_youtube_id) as any;
    if (yt) return brandingFromChannel(yt);
  }
  if (channel?.id && String(channel.id).startsWith('custom_')) return emptyManualBranding();
  return brandingFromChannel(channel);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

function createEmptyOwnerChannel() {
  const channelId = `custom_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const hasActive = db.prepare('SELECT 1 FROM channels WHERE is_active_owner = 1 LIMIT 1').get();
  db.prepare(`
    INSERT INTO channels (
      id, title, handle, description, avatar_url, banner_url, subscriber_count, is_owner, is_active_owner, origin_branding, created_at, updated_at
    ) VALUES (
      ?, ?, '', '', '', '', '', 1, ?, ?, datetime('now'), datetime('now')
    )
  `).run(channelId, DEFAULT_OWNER_TITLE, hasActive ? 0 : 1, JSON.stringify(emptyManualBranding()));

  db.prepare(`
    INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at, created_at)
    VALUES (?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(channel_id) DO NOTHING
  `).run(channelId);

  return db.prepare(`${ownerSelectSql()} WHERE c.id = ?`).get(channelId);
}

function loadOwnerRow(id: string) {
  return db.prepare(`${ownerSelectSql()} WHERE c.id = ?`).get(id);
}

function setActiveOwner(id: string) {
  db.prepare('UPDATE channels SET is_active_owner = 0').run();
  db.prepare(`
    UPDATE channels
    SET is_owner = 1, is_active_owner = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

function ensureSubscribed(channelId: string) {
  db.prepare(`
    INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at, created_at)
    VALUES (?, 0, datetime('now'), datetime('now'))
    ON CONFLICT(channel_id) DO NOTHING
  `).run(channelId);
}

function youtubeAutoDownloadTarget(channel: { id?: string; linked_youtube_id?: string | null } | null | undefined): string | null {
  if (!channel?.id) return null;
  if (channel.linked_youtube_id) return channel.linked_youtube_id;
  if (String(channel.id).startsWith('custom_')) return null;
  return channel.id;
}

function attachAutoDownload(channel: any) {
  if (!channel) return channel;
  const targetId = youtubeAutoDownloadTarget(channel);
  channel.auto_download_channel_id = targetId;
  if (targetId && targetId !== channel.id) {
    const sub = db.prepare(`
      SELECT auto_download, COALESCE(auto_download_mode, 'future') as auto_download_mode
      FROM subscriptions WHERE channel_id = ?
    `).get(targetId) as { auto_download: number; auto_download_mode: string } | undefined;
    channel.auto_download = sub?.auto_download ?? 0;
    channel.auto_download_mode = sub?.auto_download_mode ?? 'future';
  } else if (channel.auto_download_mode == null) {
    channel.auto_download_mode = 'future';
  }
  return channel;
}

function getPersonalChannel() {
  const custom = db.prepare(`${ownerSelectSql()} WHERE c.id LIKE 'custom_%' AND c.is_owner = 1 ORDER BY c.updated_at DESC LIMIT 1`).get();
  if (custom) return custom;
  return ensureOwnerChannel();
}

function ensureOwnerChannel() {
  const active = db.prepare(`${ownerSelectSql()} WHERE c.is_active_owner = 1 LIMIT 1`).get();
  if (active) {
    const customExists = db.prepare(`SELECT 1 FROM channels WHERE id LIKE 'custom_%' AND is_owner = 1 LIMIT 1`).get();
    if (!customExists) createEmptyOwnerChannel();
    return loadOwnerRow((active as any).id);
  }

  const custom = db.prepare(`${ownerSelectSql()} WHERE c.id LIKE 'custom_%' AND c.is_owner = 1 ORDER BY c.updated_at DESC LIMIT 1`).get() as any;
  if (custom) {
    setActiveOwner(custom.id);
    return loadOwnerRow(custom.id);
  }

  const ytOwner = db.prepare(`${ownerSelectSql()} WHERE c.is_owner = 1 ORDER BY c.updated_at DESC LIMIT 1`).get() as any;
  if (ytOwner && !String(ytOwner.id).startsWith('custom_')) {
    const created = createEmptyOwnerChannel() as any;
    db.prepare(`
      UPDATE channels SET
        title = ?, handle = ?, description = ?, avatar_url = ?, banner_url = ?,
        linked_youtube_id = ?, owner_branding_backup = ?, is_owner = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      ytOwner.title || DEFAULT_OWNER_TITLE,
      ytOwner.handle || '',
      ytOwner.description || '',
      ytOwner.avatar_url || '',
      ytOwner.banner_url || '',
      ytOwner.id,
      JSON.stringify(emptyManualBranding()),
      created.id
    );
    setActiveOwner(created.id);
    return loadOwnerRow(created.id);
  }

  const created = createEmptyOwnerChannel() as any;
  setActiveOwner(created.id);
  return loadOwnerRow(created.id);
}

function channelVideoIds(channel: any): string[] {
  return [...new Set([channel?.id, channel?.handle, channel?.linked_youtube_id].filter(Boolean))];
}

async function persistLiveChannelAssets(channelId: string, details: any) {
  const images = await materializeChannelBranding(channelId, details.avatarUrl || '', details.bannerUrl || '');
  prefetchCatalogThumbs((details.videos || []).map((v: any) => v.id));
  return images;
}

function loadChannelVideos(channel: any, downloaded: boolean) {
  const ids = channelVideoIds(channel);
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`
    SELECT v.*, c.avatar_url as channel_avatar
    FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE v.channel_id IN (${placeholders}) AND v.is_downloaded = ?
    ORDER BY v.upload_date DESC, v.created_at DESC
  `).all(...ids, downloaded ? 1 : 0);
}

function upsertYoutubeCatalog(details: any) {
  db.prepare(`
    INSERT INTO channels (
      id, title, handle, description, avatar_url, banner_url, subscriber_count, video_count, is_owner, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      handle = excluded.handle,
      description = excluded.description,
      avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
      banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
      subscriber_count = excluded.subscriber_count,
      video_count = CASE WHEN excluded.video_count > IFNULL(channels.video_count, 0) THEN excluded.video_count ELSE channels.video_count END,
      updated_at = datetime('now')
  `).run(
    details.id,
    details.title,
    details.handle || `@${String(details.title || '').replace(/\s+/g, '')}`,
    details.description || '',
    details.avatarUrl || '',
    details.bannerUrl || '',
    details.subscriberCount || '',
    details.videoCount || 0
  );
  ensureOriginBranding(details.id, brandingFromDetails(details));

  if (!details.videos || details.videos.length === 0) return;

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

// GET my primary owned channel (always exists)
router.get('/my-channel', (req, res) => {
  try {
    const myChannel = ensureOwnerChannel();
    res.json(applyChannelLocale(attachAutoDownload(myChannel) || null));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST link personal channel to a YouTube @handle
router.post('/link-youtube', async (req, res) => {
  if (isLocalOnly()) {
    return res.status(400).json({ error: 'YouTube linking is disabled in local mode.', code: 'LOCAL_ONLY' });
  }

  const handle = parseYoutubeHandle(req.body?.handle || req.body?.url || '');
  if (!handle) {
    return res.status(400).json({ error: 'Use a YouTube @handle (e.g. @mychannel).' });
  }

  try {
    const owner = getPersonalChannel() as any;
    const details = await getChannelDetails(handle, 50);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }

    if (owner?.linked_youtube_id && owner.linked_youtube_id === details.id) {
      return res.status(400).json({ error: 'This channel is already linked as your main YouTube channel.' });
    }

    const alreadyExtra = db.prepare('SELECT id FROM channels WHERE id = ? AND is_owner = 1').get(details.id) as any;
    if (alreadyExtra && alreadyExtra.id !== owner.id) {
      return res.status(400).json({ error: 'This channel is already linked as an extra channel.' });
    }

    const backup = owner.linked_youtube_id
      ? owner.owner_branding_backup || JSON.stringify(emptyManualBranding())
      : JSON.stringify(brandingFromChannel(owner));

    const [ownerImages, ytImages] = await Promise.all([
      persistLiveChannelAssets(owner.id, details),
      persistLiveChannelAssets(details.id, details),
    ]);

    db.prepare(`
      UPDATE channels SET
        title = ?,
        handle = ?,
        description = ?,
        avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
        banner_url = COALESCE(NULLIF(?, ''), banner_url),
        subscriber_count = ?,
        video_count = ?,
        linked_youtube_id = ?,
        owner_branding_backup = ?,
        origin_branding = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      details.title || owner.title,
      details.handle || handle,
      details.description || '',
      ownerImages.avatarUrl || details.avatarUrl || '',
      ownerImages.bannerUrl || details.bannerUrl || '',
      details.subscriberCount || owner.subscriber_count || '',
      details.videoCount || 0,
      details.id,
      backup,
      JSON.stringify(brandingFromDetails(details, ownerImages)),
      owner.id
    );

    upsertYoutubeCatalog({
      ...details,
      avatarUrl: ytImages.avatarUrl || details.avatarUrl,
      bannerUrl: ytImages.bannerUrl || details.bannerUrl,
    });

    const updated = loadOwnerRow(owner.id) as any;
    if (updated) {
      saveContentLocale('channel', updated.id, {
        title: updated.title,
        description: updated.description,
      });
    }
    res.json({ success: true, channel: applyChannelLocale(updated) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST unlink YouTube and restore the manual branding snapshot
router.post('/unlink-youtube', (req, res) => {
  try {
    const owner = getPersonalChannel() as any;
    if (!owner?.linked_youtube_id) {
      return res.status(400).json({ error: 'No YouTube channel is linked' });
    }

    let backup: OwnerBranding = emptyManualBranding();
    try {
      if (owner.owner_branding_backup) {
        backup = { ...emptyManualBranding(), ...JSON.parse(owner.owner_branding_backup) };
      }
    } catch (_) {}

    db.prepare(`
      UPDATE channels SET
        title = ?,
        handle = ?,
        description = ?,
        avatar_url = ?,
        banner_url = ?,
        subscriber_count = '',
        linked_youtube_id = NULL,
        owner_branding_backup = NULL,
        origin_branding = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      backup.title || DEFAULT_OWNER_TITLE,
      backup.handle || '',
      backup.description || '',
      backup.avatar_url || '',
      backup.banner_url || '',
      JSON.stringify(emptyManualBranding()),
      owner.id
    );

    clearContentLocale('channel', owner.id);

    const updated = loadOwnerRow(owner.id) as any;
    res.json({ success: true, channel: applyChannelLocale(updated) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST link an extra owned YouTube channel (does not replace the current one)
router.post('/link-extra-youtube', async (req, res) => {
  if (isLocalOnly()) {
    return res.status(400).json({ error: 'YouTube linking is disabled in local mode.', code: 'LOCAL_ONLY' });
  }

  const handle = parseYoutubeHandle(req.body?.handle || req.body?.url || '');
  if (!handle) {
    return res.status(400).json({ error: 'Use a YouTube @handle (e.g. @mychannel).' });
  }

  try {
    const personal = getPersonalChannel() as any;
    const details = await getChannelDetails(handle, 50);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }

    if (personal?.linked_youtube_id && personal.linked_youtube_id === details.id) {
      return res.status(400).json({ error: 'This channel is already linked as your main YouTube channel.' });
    }
    if (personal?.id === details.id) {
      return res.status(400).json({ error: 'This channel is already your current channel.' });
    }

    const images = await persistLiveChannelAssets(details.id, details);
    upsertYoutubeCatalog({
      ...details,
      avatarUrl: images.avatarUrl || details.avatarUrl,
      bannerUrl: images.bannerUrl || details.bannerUrl,
    });
    db.prepare(`
      UPDATE channels
      SET is_owner = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(details.id);
    ensureOriginBranding(details.id, brandingFromDetails(details, images));
    ensureSubscribed(details.id);

    const extra = loadOwnerRow(details.id) as any;
    res.json({ success: true, channel: applyChannelLocale(extra) });
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
        COALESCE(s.auto_download_mode, 'future') as auto_download_mode,
        s.max_resolution, 
        s.last_scanned_at,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
      FROM channels c
      LEFT JOIN subscriptions s ON s.channel_id = c.id
      WHERE c.is_owner = 1
      ORDER BY c.is_active_owner DESC, c.updated_at DESC
    `).all();

    res.json(applyChannelLocales((channels as any[]).map(attachAutoDownload)));
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
      persistImageInput(avatarUrl, `${channelId}_avatar`),
      persistImageInput(bannerUrl, `${channelId}_banner`)
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
    const details = await getChannelDetails(url.trim(), 50);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'Chaîne YouTube introuvable' });
    }

    const images = await persistLiveChannelAssets(details.id, details);

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
      images.avatarUrl || details.avatarUrl || '',
      images.bannerUrl || details.bannerUrl || '',
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
  const body = req.body || {};

  try {
    const existing = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Chaîne introuvable' });
    }

    const origin = originBrandingFor(existing);
    const nextTitle = Object.prototype.hasOwnProperty.call(body, 'title')
      ? (String(body.title || '').trim() || origin.title || DEFAULT_OWNER_TITLE)
      : existing.title;
    const rawHandle = Object.prototype.hasOwnProperty.call(body, 'handle')
      ? String(body.handle || '').trim()
      : null;
    const nextHandle = rawHandle === null
      ? existing.handle
      : rawHandle
        ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`)
        : (origin.handle || '');
    const nextDescription = Object.prototype.hasOwnProperty.call(body, 'description')
      ? (String(body.description || '').trim() || origin.description || '')
      : existing.description;

    let nextAvatar = existing.avatar_url || '';
    if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
      nextAvatar = isBlank(body.avatarUrl)
        ? (origin.avatar_url || '')
        : persistImageInput(body.avatarUrl, `${id}_avatar`);
    }
    let nextBanner = existing.banner_url || '';
    if (Object.prototype.hasOwnProperty.call(body, 'bannerUrl')) {
      nextBanner = isBlank(body.bannerUrl)
        ? (origin.banner_url || '')
        : persistImageInput(body.bannerUrl, `${id}_banner`);
    }

    db.prepare(`
      UPDATE channels SET
        title = ?,
        handle = ?,
        description = ?,
        avatar_url = ?,
        banner_url = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(nextTitle, nextHandle, nextDescription, nextAvatar, nextBanner, id);

    const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (updated) {
      if (String(id).startsWith('custom_') && !updated.linked_youtube_id) {
        clearContentLocale('channel', id);
      } else {
        saveContentLocale('channel', id, {
          title: updated.title,
          description: updated.description,
        });
      }
    }
    res.json({ success: true, channel: applyChannelLocale(updated) });
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

    if (!channel.is_owner) {
      return res.status(400).json({ error: 'This channel is not linked to your profile' });
    }

    setActiveOwner(id);
    const updated = loadOwnerRow(id) as any;
    res.json({ success: true, channel: applyChannelLocale(updated) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST unclaim channel (removes is_owner status from this channel)
router.post('/:id/unclaim', (req, res) => {
  const { id } = req.params;
  try {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (!channel) {
      return res.status(404).json({ error: 'Chaîne introuvable' });
    }
    if (String(id).startsWith('custom_')) {
      return res.status(400).json({ error: 'The personal channel cannot be unlinked this way' });
    }

    const wasActive = channel.is_active_owner === 1;
    db.prepare(`
      UPDATE channels
      SET is_owner = 0, is_active_owner = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    if (wasActive) {
      const personal = getPersonalChannel() as any;
      if (personal?.id) setActiveOwner(personal.id);
    }

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
        COALESCE(s.auto_download_mode, 'future') as auto_download_mode,
        s.max_resolution, 
        s.last_scanned_at,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.is_downloaded = 1) as downloaded_count,
        (SELECT count(*) FROM videos v WHERE v.channel_id = c.id) as total_detected_videos
      FROM subscriptions s
      JOIN channels c ON s.channel_id = c.id
      ORDER BY c.title COLLATE NOCASE ASC
    `).all() as any[];

    for (const channel of channels) {
      const clean = sanitizeAvatarUrl(channel.avatar_url);
      if (clean && clean !== channel.avatar_url) {
        db.prepare('UPDATE channels SET avatar_url = ? WHERE id = ?').run(clean, channel.id);
        channel.avatar_url = clean;
      }
    }

    res.json(applyChannelLocales(channels));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET more online videos for a channel (pagination / "Voir plus")
router.get('/:id/more-videos', async (req, res) => {
  const { id } = req.params;
  const offset = Math.max(0, parseInt(req.query.offset as string || '50', 10));
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '50', 10)), 100);

  if (isLocalOnly()) {
    return res.json({ videos: [], hasMore: false });
  }

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
      language: v.language || '',
    }));

    if (formattedVideos.length > 0) {
      const insertVideoStmt = db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, duration, duration_string,
          view_count, upload_date, thumbnail_url, is_downloaded, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          thumbnail_url = COALESCE(NULLIF(excluded.thumbnail_url, ''), videos.thumbnail_url),
          duration_string = COALESCE(NULLIF(excluded.duration_string, ''), videos.duration_string),
          language = COALESCE(NULLIF(excluded.language, ''), videos.language),
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
            v.thumbnail_url,
            v.language || ''
          );
        } catch (_) {}
      }
    }

    res.json({
      videos: applyVideoLocales(formattedVideos),
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
      SELECT c.*, s.auto_download, COALESCE(s.auto_download_mode, 'future') as auto_download_mode, s.max_resolution, s.last_scanned_at,
             CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
      FROM channels c
      LEFT JOIN subscriptions s ON c.id = s.channel_id
      WHERE c.id = ? OR c.handle = ? OR c.handle = ?
    `).get(id, handleWithAt, handleWithoutAt) as any;

    // Fetch downloaded videos of this channel
    let downloadedVideos = channel ? loadChannelVideos(channel, true) : [];

    // Fetch online detected videos of this channel
    let detectedVideos = channel ? loadChannelVideos(channel, false) : [];

    // If channel is missing in DB or has missing banner/avatar or has 0 videos, fetch LIVE synchronously
    const skipLive =
      isLocalOnly() ||
      (id && String(id).startsWith('custom_')) ||
      (channel?.id && String(channel.id).startsWith('custom_'));
    if (!skipLive && (!channel || !channel.avatar_url || (detectedVideos.length === 0 && downloadedVideos.length === 0))) {
      try {
        const liveQuery = channel?.handle || channel?.id || id;
        const liveDetails = await getChannelDetails(liveQuery, 50);

        if (liveDetails && liveDetails.id) {
          const effectiveId = liveDetails.id;
          const images = await persistLiveChannelAssets(effectiveId, liveDetails);

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
              video_count = CASE WHEN excluded.video_count > IFNULL(channels.video_count, 0) THEN excluded.video_count ELSE channels.video_count END,
              updated_at = datetime('now')
          `).run(
            effectiveId,
            liveDetails.title,
            liveDetails.handle || channel?.handle || '',
            liveDetails.description || channel?.description || '',
            images.avatarUrl || liveDetails.avatarUrl || channel?.avatar_url || '',
            images.bannerUrl || liveDetails.bannerUrl || channel?.banner_url || '',
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
            SELECT c.*, s.auto_download, COALESCE(s.auto_download_mode, 'future') as auto_download_mode, s.max_resolution, s.last_scanned_at,
                   CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
            FROM channels c
            LEFT JOIN subscriptions s ON c.id = s.channel_id
            WHERE c.id = ?
          `).get(effectiveId) as any;

          // Reload videos
          downloadedVideos = loadChannelVideos(channel, true);

          detectedVideos = loadChannelVideos(channel, false);
        }
      } catch (err: any) {
        console.error('Error fetching live channel:', err.message);
      }
    }

    if (!channel) {
      return res.status(404).json({ error: 'Chaîne introuvable sur YouTube' });
    }

    if (!skipLive && Array.isArray(detectedVideos) && detectedVideos.length > 0) {
      await hydrateOriginalVideos(detectedVideos as any[]);
    }

    if (!skipLive && channel.id && !String(channel.id).startsWith('custom_')) {
      const knownCount = Number(detectedVideos.length || 0) + Number(downloadedVideos.length || 0);
      channel.video_count = await ensureChannelVideoCount(channel.id, knownCount);
    }

    if (channel.avatar_url) channel.avatar_url = sanitizeAvatarUrl(channel.avatar_url);
    attachAutoDownload(channel);

    res.json({
      channel: applyChannelLocale(channel),
      downloadedVideos: applyVideoLocales(downloadedVideos as any[]),
      detectedVideos: applyVideoLocales(detectedVideos as any[]),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST subscribe to channel (by URL, ID or handle)
router.post('/subscribe', async (req, res) => {
  const { url, autoDownload = 0, maxResolution = '1080p' } = req.body;
  if (isLocalOnly()) {
    return res.status(400).json({ error: 'Channel subscribe is disabled in local mode.', code: 'LOCAL_ONLY' });
  }
  if (!url) {
    return res.status(400).json({ error: 'URL ou identifiant de chaîne requis' });
  }

  try {
    // When subscribing, fetch all available videos of the channel without limit
    const details = await getChannelDetails(url, 100);
    if (!details || !details.id) {
      return res.status(404).json({ error: 'Impossible de trouver la chaîne' });
    }

    const images = await persistLiveChannelAssets(details.id, details);

    // 1. Insert or update channel in DB
    db.prepare(`
      INSERT INTO channels (
        id, title, handle, description, avatar_url, banner_url, subscriber_count, video_count, language, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        handle = COALESCE(NULLIF(excluded.handle, ''), channels.handle),
        title = COALESCE(NULLIF(excluded.title, ''), channels.title),
        description = COALESCE(NULLIF(excluded.description, ''), channels.description),
        avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
        banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
        subscriber_count = excluded.subscriber_count,
        video_count = CASE WHEN excluded.video_count > IFNULL(channels.video_count, 0) THEN excluded.video_count ELSE channels.video_count END,
        language = COALESCE(NULLIF(excluded.language, ''), channels.language),
        updated_at = datetime('now')
    `).run(
      details.id,
      details.title,
      details.handle,
      details.description,
      images.avatarUrl || details.avatarUrl,
      images.bannerUrl || details.bannerUrl,
      details.subscriberCount,
      details.videoCount,
      details.language || ''
    );
    ensureOriginBranding(details.id, brandingFromDetails(details, images));

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
          upload_date, thumbnail_url, view_count, is_downloaded, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
          thumbnail_url = excluded.thumbnail_url,
          duration_string = excluded.duration_string,
          language = COALESCE(NULLIF(excluded.language, ''), videos.language),
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
            v.viewCount || 0,
            v.language || ''
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
  const { auto_download, auto_download_mode, max_resolution, download_shorts } = req.body;

  try {
    const channel = db.prepare('SELECT id, linked_youtube_id FROM channels WHERE id = ?').get(id) as { id: string; linked_youtube_id?: string | null } | undefined;
    if (!channel) {
      return res.status(404).json({ error: 'Chaîne introuvable' });
    }

    const targetId = youtubeAutoDownloadTarget(channel) || (String(id).startsWith('custom_') ? null : id);
    if (!targetId) {
      return res.status(400).json({ error: 'Auto-download is only available on YouTube channels.' });
    }

    ensureSubscribed(targetId);

    const mode = auto_download_mode === 'all' ? 'all' : auto_download_mode === 'future' ? 'future' : null;
    const enabled = auto_download === undefined ? null : (auto_download ? 1 : 0);

    db.prepare(`
      UPDATE subscriptions SET
        auto_download = COALESCE(?, auto_download),
        auto_download_mode = COALESCE(?, auto_download_mode),
        max_resolution = COALESCE(?, max_resolution),
        download_shorts = COALESCE(?, download_shorts)
      WHERE channel_id = ?
    `).run(
      enabled,
      enabled === 0 ? 'future' : mode,
      max_resolution !== undefined ? max_resolution : null,
      download_shorts !== undefined ? (download_shorts ? 1 : 0) : null,
      targetId
    );

    const updated = db.prepare(`
      SELECT auto_download, COALESCE(auto_download_mode, 'future') as auto_download_mode
      FROM subscriptions WHERE channel_id = ?
    `).get(targetId) as { auto_download: number; auto_download_mode: string };

    if (updated?.auto_download === 1 && updated.auto_download_mode === 'all') {
      void downloadQueue.enqueueChannelCatalog(targetId);
    }

    res.json({
      success: true,
      message: 'Paramètres mis à jour',
      auto_download: updated?.auto_download ?? 0,
      auto_download_mode: updated?.auto_download_mode ?? 'future',
      auto_download_channel_id: targetId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
