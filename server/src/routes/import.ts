import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { DOWNLOADS_DIR, DATA_DIR } from '../config.js';
import { getVideoDetails, getChannelDetails, formatDuration, sanitizeFilename } from '../services/ytdlp.js';
import { isAllowedYouTubeTarget, looksLikeUrl, extractYouTubeVideoId } from '../utils/youtube.js';
import { isLocalOnly } from '../utils/settings.js';

const execFileAsync = promisify(execFile);
const router = Router();

// Temp uploads directory
const UPLOADS_TEMP_DIR = path.join(DATA_DIR, 'temp_uploads');
if (!fs.existsSync(UPLOADS_TEMP_DIR)) {
  fs.mkdirSync(UPLOADS_TEMP_DIR, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const uniqueName = `upload_${Date.now()}_${uuidv4().slice(0, 8)}${ext || '.mp4'}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10 GB limit
  },
});

// Helper: Extract video duration via ffmpeg/ffprobe safely
async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    if (!isNaN(duration) && duration > 0) {
      return Math.round(duration);
    }
  } catch (_) {
    try {
      // Fallback: run ffmpeg -i and parse Duration from stderr
      const { stderr } = await execFileAsync('ffmpeg', ['-i', filePath]).catch((e: any) => ({ stderr: e.stderr || '' }));
      const match = (stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        return Math.round(hours * 3600 + minutes * 60 + seconds);
      }
    } catch (_) {}
  }
  return 0;
}

// Helper: Generate thumbnail screenshot from video via ffmpeg safely
async function generateVideoThumbnail(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', '00:00:02',
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      outputPath
    ]);
    return fs.existsSync(outputPath);
  } catch (_) {
    try {
      // If video is shorter than 2s, take frame at 00:00:00
      await execFileAsync('ffmpeg', [
        '-y',
        '-ss', '00:00:00',
        '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        outputPath
      ]);
      return fs.existsSync(outputPath);
    } catch (_) {
      return false;
    }
  }
}

// POST /api/import/inspect-url
// Inspect any YouTube video or channel link without downloading
router.post('/inspect-url', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL requise' });
  }

  const trimmed = url.trim();
  if (looksLikeUrl(trimmed) && !isAllowedYouTubeTarget(trimmed)) {
    return res.status(400).json({ error: 'Seuls les liens YouTube sont acceptés.' });
  }

  let videoId = extractYouTubeVideoId(trimmed) || '';

  if (isLocalOnly() && !videoId) {
    return res.status(400).json({
      error: 'Local mode only accepts a direct video link, not a channel.',
      code: 'CHANNEL_NOT_ALLOWED',
    });
  }

  if (videoId) {
    try {
      const vDetails = await getVideoDetails(videoId);
      if (vDetails && vDetails.id) {
        return res.json({
          type: 'video',
          video: {
            id: vDetails.id,
            title: vDetails.title,
            channelTitle: vDetails.channelTitle,
            channelId: vDetails.channelId,
            duration: vDetails.duration || 0,
            durationString: vDetails.duration ? formatDuration(vDetails.duration) : '',
            thumbnailUrl: vDetails.thumbnailUrl || `https://i.ytimg.com/vi/${vDetails.id}/hqdefault.jpg`,
            description: vDetails.description || '',
            viewCount: vDetails.viewCount || 0,
            uploadDate: vDetails.uploadDate || '',
            url: `https://www.youtube.com/watch?v=${vDetails.id}`,
            language: vDetails.language || '',
          },
        });
      }
    } catch (err: any) {
      console.error('inspect-url video error:', err.message);
    }
  }

  // 2. Check if it is a channel URL or handle
  try {
    const details = await getChannelDetails(trimmed, 1);
    if (details && details.id) {
      return res.json({
        type: 'channel',
        channel: {
          id: details.id,
          title: details.title,
          handle: details.handle || `@${details.title.replace(/\s+/g, '')}`,
          avatarUrl: details.avatarUrl || '',
          bannerUrl: details.bannerUrl || '',
          description: details.description || '',
          subscriberCount: details.subscriberCount || '',
          videoCount: details.videoCount || 0,
          language: details.language || '',
          url: `https://www.youtube.com/channel/${details.id}`,
        },
      });
    }
  } catch (_) {}

  return res.status(404).json({ error: 'Impossible d\'analyser ce lien YouTube. Vérifiez le format de l\'URL.' });
});

// POST /api/import/file
// Import a local video file (.mp4, .mkv, etc.) with optional YouTube pairing or dedicated channel creation
router.post('/file', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const videoFile = files?.video?.[0];
  const thumbnailFile = files?.thumbnail?.[0];

  if (!videoFile) {
    return res.status(400).json({ error: 'Aucun fichier vidéo fourni' });
  }

  const {
    title,
    description = '',
    channelId: rawChannelId,
    originalUrl = '',
    createChannel: rawCreateChannel,
  } = req.body;

  try {
    let channelId = rawChannelId;
    let channelTitle = 'Vidéos Importées';

    let createChannelData: any = null;
    if (rawCreateChannel) {
      try {
        createChannelData = typeof rawCreateChannel === 'string' ? JSON.parse(rawCreateChannel) : rawCreateChannel;
      } catch (_) {}
    }

    // 1. Handle Channel Creation or Resolution
    if (createChannelData && createChannelData.title) {
      // Create new dedicated custom channel
      const handleClean = createChannelData.handle 
        ? (createChannelData.handle.startsWith('@') ? createChannelData.handle : `@${createChannelData.handle}`)
        : `@${createChannelData.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      
      channelId = `custom_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      channelTitle = createChannelData.title.trim();

      db.prepare(`
        INSERT INTO channels (
          id, title, handle, description, avatar_url, banner_url, subscriber_count, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Espace Dédié', datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          handle = excluded.handle,
          description = excluded.description,
          avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
          banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
          updated_at = datetime('now')
      `).run(
        channelId,
        channelTitle,
        handleClean,
        createChannelData.description || '',
        createChannelData.avatarUrl || '',
        createChannelData.bannerUrl || ''
      );

      // Auto-subscribe to this custom channel so it shows in the sidebar
      db.prepare(`
        INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at)
        VALUES (?, 0, datetime('now'))
        ON CONFLICT(channel_id) DO NOTHING
      `).run(channelId);
    } else if (channelId) {
      // Existing channel in database
      const existing = db.prepare('SELECT id, title FROM channels WHERE id = ?').get(channelId) as any;
      if (existing) {
        channelTitle = existing.title;
      }
    } else {
      // Default Imported Videos Space
      channelId = 'custom_imported';
      channelTitle = 'Vidéos Importées';
      db.prepare(`
        INSERT INTO channels (id, title, handle, description, avatar_url, subscriber_count, updated_at)
        VALUES ('custom_imported', 'Vidéos Importées', '@import', 'Archive de vidéos importées localement', '', 'Archive', datetime('now'))
        ON CONFLICT(id) DO NOTHING
      `).run();

      db.prepare(`
        INSERT INTO subscriptions (channel_id, auto_download, last_scanned_at)
        VALUES ('custom_imported', 0, datetime('now'))
        ON CONFLICT(channel_id) DO NOTHING
      `).run();
    }

    // 2. Generate unique video ID
    let videoId = '';
    if (originalUrl) {
      const match = originalUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    }
    if (!videoId) {
      videoId = `imp_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    }

    const videoTitle = (title || videoFile.originalname.replace(/\.[^/.]+$/, '')).trim();

    // 3. Setup Target Folder in DOWNLOADS_DIR/<ChannelTitle>/
    const sanitizedChannelDir = sanitizeFilename(channelTitle) || 'Vidéos Importées';
    const channelFolderPath = path.join(DOWNLOADS_DIR, sanitizedChannelDir);
    if (!fs.existsSync(channelFolderPath)) {
      fs.mkdirSync(channelFolderPath, { recursive: true });
    }

    const sanitizedVideoTitle = sanitizeFilename(videoTitle) || 'Video';
    const finalVideoExt = path.extname(videoFile.originalname) || '.mp4';
    const finalVideoFileName = `${sanitizedVideoTitle} [${videoId}]${finalVideoExt}`;
    const finalVideoPath = path.join(channelFolderPath, finalVideoFileName);
    const relativeVideoPath = path.join(sanitizedChannelDir, finalVideoFileName).replace(/\\/g, '/');

    // Move uploaded video to destination
    fs.renameSync(videoFile.path, finalVideoPath);

    // 4. Handle Thumbnail
    const finalThumbFileName = `${sanitizedVideoTitle} [${videoId}].jpg`;
    const finalThumbPath = path.join(channelFolderPath, finalThumbFileName);
    const relativeThumbPath = path.join(sanitizedChannelDir, finalThumbFileName).replace(/\\/g, '/');

    let hasThumb = false;
    if (thumbnailFile) {
      fs.renameSync(thumbnailFile.path, finalThumbPath);
      hasThumb = true;
    } else {
      // Auto-extract frame with FFmpeg
      hasThumb = await generateVideoThumbnail(finalVideoPath, finalThumbPath);
    }

    // 5. Compute Duration
    const duration = await getVideoDuration(finalVideoPath);
    const durationStr = formatDuration(duration);

    // 6. Insert into videos table in SQLite
    const fileSize = fs.existsSync(finalVideoPath) ? fs.statSync(finalVideoPath).size : videoFile.size;

    db.prepare(`
      INSERT INTO videos (
        id, channel_id, channel_title, title, description, duration, duration_string,
        view_count, upload_date, thumbnail_url, local_video_path, local_thumbnail_path,
        file_size, is_downloaded, downloaded_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        0, datetime('now'), ?, ?, ?,
        ?, 1, datetime('now'), datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        channel_id = excluded.channel_id,
        channel_title = excluded.channel_title,
        title = excluded.title,
        description = excluded.description,
        duration = excluded.duration,
        duration_string = excluded.duration_string,
        thumbnail_url = excluded.thumbnail_url,
        local_video_path = excluded.local_video_path,
        local_thumbnail_path = excluded.local_thumbnail_path,
        file_size = excluded.file_size,
        is_downloaded = 1,
        downloaded_at = datetime('now')
    `).run(
      videoId,
      channelId,
      channelTitle,
      videoTitle,
      description,
      duration,
      durationStr,
      hasThumb ? `/media/downloads/${relativeThumbPath.replace(/\\/g, '/')}` : '',
      relativeVideoPath,
      hasThumb ? relativeThumbPath : null,
      fileSize
    );

    const insertedVideo = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.id = ?
    `).get(videoId);

    res.json({
      success: true,
      message: 'Vidéo importée et archivée avec succès !',
      video: insertedVideo,
      channelId,
    });
  } catch (err: any) {
    console.error('Import file error:', err);
    // Cleanup temporary files
    if (videoFile && fs.existsSync(videoFile.path)) {
      try { fs.unlinkSync(videoFile.path); } catch (_) {}
    }
    if (thumbnailFile && fs.existsSync(thumbnailFile.path)) {
      try { fs.unlinkSync(thumbnailFile.path); } catch (_) {}
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
