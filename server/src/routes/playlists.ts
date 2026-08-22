import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { applyVideoLocales } from '../utils/contentLocale.js';

export const LIKED_PLAYLIST_ID = 'liked';

const router = Router();

function likedCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM videos WHERE liked = 1`).get() as { n: number };
  return Number(row?.n || 0);
}

function likedCover(): { cover_thumb?: string; cover_video_id?: string; local_thumbnail_path?: string; is_downloaded?: number } {
  const video = db.prepare(`
    SELECT id, thumbnail_url, local_thumbnail_path, is_downloaded
    FROM videos
    WHERE liked = 1
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).get() as any;
  if (!video) return {};
  return {
    cover_thumb: video.thumbnail_url || '',
    cover_video_id: video.id,
    local_thumbnail_path: video.local_thumbnail_path || '',
    is_downloaded: video.is_downloaded || 0,
  };
}

function playlistCover(playlistId: string) {
  const video = db.prepare(`
    SELECT v.id, v.thumbnail_url, v.local_thumbnail_path, v.is_downloaded
    FROM playlist_videos pv
    JOIN videos v ON v.id = pv.video_id
    WHERE pv.playlist_id = ?
    ORDER BY pv.position ASC, pv.added_at ASC
    LIMIT 1
  `).get(playlistId) as any;
  if (!video) return {};
  return {
    cover_thumb: video.thumbnail_url || '',
    cover_video_id: video.id,
    local_thumbnail_path: video.local_thumbnail_path || '',
    is_downloaded: video.is_downloaded || 0,
  };
}

function videoInLiked(videoId: string): boolean {
  const row = db.prepare(`SELECT liked FROM videos WHERE id = ?`).get(videoId) as { liked: number } | undefined;
  return Number(row?.liked || 0) === 1;
}

function videoInPlaylist(playlistId: string, videoId: string): boolean {
  if (playlistId === LIKED_PLAYLIST_ID) return videoInLiked(videoId);
  const row = db.prepare(`
    SELECT 1 AS ok FROM playlist_videos WHERE playlist_id = ? AND video_id = ?
  `).get(playlistId, videoId);
  return !!row;
}

function serializePlaylist(row: any, containsVideoId?: string) {
  const item = {
    id: row.id,
    title: row.title,
    system: row.id === LIKED_PLAYLIST_ID,
    video_count: Number(row.video_count || 0),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    cover_thumb: row.cover_thumb || '',
    cover_video_id: row.cover_video_id || '',
    local_thumbnail_path: row.local_thumbnail_path || '',
    is_downloaded: Number(row.is_downloaded || 0),
    contains: false,
  };
  if (containsVideoId) item.contains = videoInPlaylist(row.id, containsVideoId);
  return item;
}

function likedSummary(containsVideoId?: string) {
  const cover = likedCover();
  return serializePlaylist({
    id: LIKED_PLAYLIST_ID,
    title: 'Liked',
    video_count: likedCount(),
    created_at: null,
    updated_at: null,
    ...cover,
  }, containsVideoId);
}

router.get('/', (req, res) => {
  const containsVideoId = typeof req.query.contains === 'string' ? req.query.contains : '';
  try {
    const rows = db.prepare(`
      SELECT
        p.id,
        p.title,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM playlist_videos pv WHERE pv.playlist_id = p.id) as video_count
      FROM playlists p
      ORDER BY p.updated_at DESC, p.created_at DESC
    `).all() as any[];

    const playlists = [
      likedSummary(containsVideoId),
      ...rows.map((row) => serializePlaylist({ ...row, ...playlistCover(row.id) }, containsVideoId)),
    ];
    res.json(playlists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (title.length > 80) return res.status(400).json({ error: 'Title too long' });

  try {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO playlists (id, title, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).run(id, title);
    res.status(201).json(serializePlaylist({
      id,
      title,
      video_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  try {
    if (id === LIKED_PLAYLIST_ID) {
      const videos = applyVideoLocales(db.prepare(`
        SELECT v.*, c.avatar_url as channel_avatar
        FROM videos v
        LEFT JOIN channels c ON v.channel_id = c.id
        WHERE v.liked = 1
        ORDER BY v.updated_at DESC, v.created_at DESC
      `).all() as any[]);
      return res.json({
        playlist: likedSummary(),
        videos,
      });
    }

    const row = db.prepare(`SELECT * FROM playlists WHERE id = ?`).get(id) as any;
    if (!row) return res.status(404).json({ error: 'Playlist not found' });

    const videos = applyVideoLocales(db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM playlist_videos pv
      JOIN videos v ON v.id = pv.video_id
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE pv.playlist_id = ?
      ORDER BY pv.position ASC, pv.added_at ASC
    `).all(id) as any[]);

    res.json({
      playlist: serializePlaylist({ ...row, video_count: videos.length, ...playlistCover(id) }),
      videos,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  if (id === LIKED_PLAYLIST_ID) return res.status(400).json({ error: 'Cannot rename this playlist' });
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const result = db.prepare(`
      UPDATE playlists SET title = ?, updated_at = datetime('now') WHERE id = ?
    `).run(title, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ ok: true, title });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (id === LIKED_PLAYLIST_ID) return res.status(400).json({ error: 'Cannot delete this playlist' });
  try {
    const result = db.prepare(`DELETE FROM playlists WHERE id = ?`).run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/videos', (req, res) => {
  const { id } = req.params;
  const videoId = String(req.body?.videoId || '').trim();
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  try {
    const video = db.prepare(`SELECT id FROM videos WHERE id = ?`).get(videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (id === LIKED_PLAYLIST_ID) {
      db.prepare(`UPDATE videos SET liked = 1, updated_at = datetime('now') WHERE id = ?`).run(videoId);
      return res.json({ ok: true, contains: true });
    }

    const playlist = db.prepare(`SELECT id FROM playlists WHERE id = ?`).get(id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const maxPos = db.prepare(`
      SELECT COALESCE(MAX(position), -1) as n FROM playlist_videos WHERE playlist_id = ?
    `).get(id) as { n: number };

    db.prepare(`
      INSERT INTO playlist_videos (playlist_id, video_id, position, added_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(playlist_id, video_id) DO NOTHING
    `).run(id, videoId, Number(maxPos.n) + 1);
    db.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`).run(id);
    res.json({ ok: true, contains: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/videos/:videoId', (req, res) => {
  const { id, videoId } = req.params;
  try {
    if (id === LIKED_PLAYLIST_ID) {
      db.prepare(`UPDATE videos SET liked = 0, updated_at = datetime('now') WHERE id = ?`).run(videoId);
      return res.json({ ok: true, contains: false });
    }

    const result = db.prepare(`
      DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?
    `).run(id, videoId);
    if (result.changes > 0) {
      db.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`).run(id);
    }
    res.json({ ok: true, contains: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
