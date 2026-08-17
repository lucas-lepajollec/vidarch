import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database.js';
import { DOWNLOADS_DIR, isSafePath } from '../config.js';
import { getVideoDetails, getChannelDetails } from '../services/ytdlp.js';

const router = Router();

// GET videos list with filtering
router.get('/', (req, res) => {
  const tab = (req.query.tab as string || 'downloaded').toLowerCase();
  const channelId = req.query.channel_id as string;
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '50', 10)), 100);
  const offset = Math.max(0, parseInt(req.query.offset as string || '0', 10));

  try {
    let query = `
      SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle 
      FROM videos v 
      LEFT JOIN channels c ON v.channel_id = c.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (channelId) {
      query += ' AND v.channel_id = ?';
      params.push(channelId);
    }

    if (tab === 'downloaded') {
      query += ' AND v.is_downloaded = 1';
    } else if (tab === 'subscriptions') {
      query += ' AND v.channel_id IN (SELECT channel_id FROM subscriptions)';
    } else if (tab === 'history') {
      query += ' AND v.watch_progress > 0';
    } else if (tab === 'liked') {
      query += ' AND v.liked = 1';
    }

    query += ' ORDER BY CASE WHEN v.is_downloaded = 1 THEN 0 ELSE 1 END, v.upload_date DESC, v.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const videos = db.prepare(query).all(...params);
    res.json(videos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET home feed with organized sections (downloaded, subscriptions un-downloaded, recent searches)
router.get('/home-feed', (req, res) => {
  try {
    // 1. Local downloaded videos
    const downloaded = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.is_downloaded = 1
      ORDER BY v.downloaded_at DESC, v.created_at DESC
      LIMIT 20
    `).all();

    // 2. Undownloaded videos from subscribed channels
    const subscriptionsUndownloaded = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.is_downloaded = 0 
        AND v.channel_id IN (SELECT channel_id FROM subscriptions)
      ORDER BY v.upload_date DESC, v.created_at DESC
      LIMIT 20
    `).all();

    // 3. Last 10 videos that appeared in recent searches
    const recentSearches = db.prepare(`
      SELECT r.*, r.video_id as id,
             COALESCE((SELECT is_downloaded FROM videos v WHERE v.id = r.video_id), 0) as is_downloaded,
             (SELECT local_thumbnail_path FROM videos v WHERE v.id = r.video_id) as local_thumbnail_path,
             c.avatar_url as channel_avatar
      FROM recent_search_videos r
      LEFT JOIN channels c ON r.channel_id = c.id
      ORDER BY r.searched_at DESC
      LIMIT 10
    `).all();

    res.json({
      downloaded,
      subscriptionsUndownloaded,
      recentSearches,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET disk-folders: real folder organization on physical drive
router.get('/disk-folders', (req, res) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      return res.json({ rootPath: DOWNLOADS_DIR, totalDiskSize: 0, folderCount: 0, videoCount: 0, folders: [] });
    }

    const dbVideos = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle 
      FROM videos v 
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.is_downloaded = 1
    `).all() as any[];

    const videoByIdMap = new Map<string, any>();
    for (const v of dbVideos) {
      if (v.id) videoByIdMap.set(v.id, v);
    }

    const items = fs.readdirSync(DOWNLOADS_DIR, { withFileTypes: true });
    const folders: any[] = [];
    let totalDiskSize = 0;

    for (const item of items) {
      if (!item.isDirectory()) continue;
      const folderName = item.name;
      const folderPath = path.join(DOWNLOADS_DIR, folderName);
      
      let files: fs.Dirent[] = [];
      try {
        files = fs.readdirSync(folderPath, { withFileTypes: true });
      } catch {
        continue;
      }

      let folderSize = 0;
      const folderVideos: any[] = [];
      const rawFiles: any[] = [];

      for (const f of files) {
        if (!f.isFile()) continue;
        const filePath = path.join(folderPath, f.name);
        let stat;
        try {
          stat = fs.statSync(filePath);
        } catch {
          continue;
        }

        folderSize += stat.size;
        totalDiskSize += stat.size;

        const isVideo = f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mkv');
        const isThumb = f.name.endsWith('.webp') || f.name.endsWith('.jpg') || f.name.endsWith('.png');
        const isJson = f.name.endsWith('.info.json') || f.name.endsWith('.json');

        rawFiles.push({
          name: f.name,
          size: stat.size,
          mtime: stat.mtime,
          type: isVideo ? 'video' : isThumb ? 'thumbnail' : isJson ? 'metadata' : 'other',
        });

        if (isVideo) {
          const match = f.name.match(/\[([a-zA-Z0-9_-]{6,15})\]\.[a-zA-Z0-9]+$/);
          const extractedId = match ? match[1] : '';
          const dbVid = (extractedId && videoByIdMap.get(extractedId)) || dbVideos.find(v => v.local_path && path.basename(v.local_path) === f.name);

          const fullVideo = dbVid ? {
            ...dbVid,
            file_size: stat.size,
            local_video_path: filePath,
          } : {
            id: extractedId || f.name,
            channel_id: folderName,
            channel_title: folderName,
            title: f.name.replace(/\[.*?\]\.[a-zA-Z0-9]+$/, '').replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '').trim() || f.name,
            duration: 0,
            duration_string: '',
            upload_date: '',
            thumbnail_url: '',
            local_thumbnail_path: '',
            local_video_path: filePath,
            file_size: stat.size,
            is_downloaded: 1,
            watch_progress: 0,
            is_watched: 0,
            liked: 0,
            created_at: stat.mtime.toISOString(),
          };

          folderVideos.push(fullVideo);
        }
      }

      const channelAvatar = folderVideos.find(v => v.channelAvatar)?.channelAvatar || '';

      folders.push({
        folderName,
        folderPath,
        folderSize,
        fileCount: files.length,
        videoCount: folderVideos.length,
        channelAvatar,
        videos: folderVideos.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime()),
        files: rawFiles,
      });
    }

    folders.sort((a, b) => b.folderSize - a.folderSize);

    res.json({
      rootPath: DOWNLOADS_DIR,
      totalDiskSize,
      folderCount: folders.length,
      videoCount: folders.reduce((sum, f) => sum + f.videoCount, 0),
      folders,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single video details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let video = db.prepare(`
      SELECT v.*, 
             c.avatar_url as channel_avatar, 
             c.banner_url as channel_banner, 
             c.handle as channel_handle, 
             c.subscriber_count as channel_subscribers
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.id = ?
    `).get(id) as any;

    if (!video || !video.description || !video.channel_avatar) {
      // Fetch or backfill missing metadata live from YouTube
      try {
        const liveInfo = await getVideoDetails(id);
        if (liveInfo) {
          if (!video) {
            video = {
              id: liveInfo.id,
              channel_id: liveInfo.channelId,
              channel_title: liveInfo.channelTitle,
              title: liveInfo.title,
              description: liveInfo.description,
              duration: liveInfo.duration,
              duration_string: liveInfo.durationString,
              view_count: liveInfo.viewCount,
              upload_date: liveInfo.uploadDate,
              thumbnail_url: liveInfo.thumbnailUrl,
              is_downloaded: 0,
              chapters: liveInfo.chapters,
            };
          } else {
            if (!video.description && liveInfo.description) {
              video.description = liveInfo.description;
              db.prepare('UPDATE videos SET description = ? WHERE id = ?').run(liveInfo.description, id);
            }
          }

          // If channel avatar is still missing and we have channelId
          const targetChannelId = liveInfo.channelId || video.channel_id;
          if (targetChannelId && !video.channel_avatar) {
            try {
              const chInfo = await getChannelDetails(targetChannelId);
              if (chInfo?.avatarUrl) {
                video.channel_avatar = chInfo.avatarUrl;
                db.prepare(`
                  INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                  ON CONFLICT(id) DO UPDATE SET
                    avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
                    banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
                    updated_at = datetime('now')
                `).run(
                  targetChannelId,
                  chInfo.title || video.channel_title,
                  chInfo.handle || '',
                  chInfo.description || '',
                  chInfo.avatarUrl,
                  chInfo.bannerUrl || '',
                  chInfo.subscriberCount || ''
                );
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    if (!video) {
      return res.status(404).json({ error: 'Vidéo introuvable' });
    }

    // Record last_watched_at immediately when video is opened
    try {
      db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, description, duration, duration_string,
          view_count, upload_date, thumbnail_url, is_downloaded, last_watched_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          last_watched_at = datetime('now'),
          title = COALESCE(NULLIF(excluded.title, ''), videos.title),
          description = COALESCE(NULLIF(excluded.description, ''), videos.description)
      `).run(
        video.id,
        video.channel_id || '',
        video.channel_title || '',
        video.title,
        video.description || '',
        video.duration || 0,
        video.duration_string || '',
        video.view_count || 0,
        video.upload_date || '',
        video.thumbnail_url || '',
        video.is_downloaded || 0
      );
    } catch (_) {}

    // Get related videos (other videos from same channel or other downloaded videos)
    const related = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.id != ? 
      ORDER BY 
        CASE WHEN v.channel_id = ? THEN 0 ELSE 1 END,
        v.is_downloaded DESC,
        v.upload_date DESC 
      LIMIT 12
    `).all(id, video.channel_id || '');

    res.json({
      video,
      related,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST update watch progress
router.post('/:id/progress', (req, res) => {
  const { id } = req.params;
  const { progress, is_watched } = req.body;

  try {
    db.prepare(`
      UPDATE videos 
      SET watch_progress = COALESCE(?, watch_progress),
          is_watched = COALESCE(?, is_watched),
          last_watched_at = datetime('now')
      WHERE id = ?
    `).run(progress, is_watched !== undefined ? (is_watched ? 1 : 0) : null, id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST toggle like
router.post('/:id/like', (req, res) => {
  const { id } = req.params;
  const { liked } = req.body;

  try {
    db.prepare(`
      UPDATE videos SET liked = ? WHERE id = ?
    `).run(liked ? 1 : 0, id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE local video file
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (video) {
      if (video.local_video_path && isSafePath(DOWNLOADS_DIR, video.local_video_path)) {
        const fullVideoPath = path.join(DOWNLOADS_DIR, video.local_video_path);
        if (fs.existsSync(fullVideoPath)) fs.unlinkSync(fullVideoPath);
      }
      if (video.local_thumbnail_path && isSafePath(DOWNLOADS_DIR, video.local_thumbnail_path)) {
        const fullThumbPath = path.join(DOWNLOADS_DIR, video.local_thumbnail_path);
        if (fs.existsSync(fullThumbPath)) fs.unlinkSync(fullThumbPath);
      }
      if (video.local_json_path && isSafePath(DOWNLOADS_DIR, video.local_json_path)) {
        const fullJsonPath = path.join(DOWNLOADS_DIR, video.local_json_path);
        if (fs.existsSync(fullJsonPath)) fs.unlinkSync(fullJsonPath);
      }

      // Mark as not downloaded in DB
      db.prepare(`
        UPDATE videos 
        SET is_downloaded = 0, local_video_path = NULL, local_thumbnail_path = NULL, local_json_path = NULL, file_size = 0
        WHERE id = ?
      `).run(id);
    }

    res.json({ success: true, message: 'Fichier supprimé avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET stream local video with HTTP 206 Partial Content
router.get('/:id/stream', (req, res) => {
  const { id } = req.params;

  try {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!video || !video.local_video_path) {
      return res.status(404).send('Vidéo non téléchargée');
    }

    if (!isSafePath(DOWNLOADS_DIR, video.local_video_path)) {
      return res.status(403).send('Chemin de fichier non autorisé');
    }

    const filePath = path.join(DOWNLOADS_DIR, video.local_video_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier introuvable sur le disque');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type based on extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mkv') contentType = 'video/x-matroska';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error('Stream error:', err.message);
    res.status(500).send('Erreur lors du streaming vidéo');
  }
});

export default router;
