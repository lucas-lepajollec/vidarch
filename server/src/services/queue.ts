import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database.js';
import { cancelDownload, downloadVideoWithProgress, formatDuration, getChannelDetails, getChannelVideos, probeVideoHeight, resolutionLabelFromMetadata } from './ytdlp.js';
import { DOWNLOADS_DIR } from '../config.js';
import { pickChannelImages, pickContentLanguage } from '../utils/youtube.js';
import { getConcurrentDownloads, getSetting, isLocalOnly } from '../utils/settings.js';
import { rememberFetchedChannel, rememberFetchedVideo } from '../utils/contentLocale.js';
import { encodeQualityNote, qualityLabelFromHeight } from '../utils/ytdlpDownload.js';

export interface QueueItem {
  id: string;
  video_id: string;
  url: string;
  channel_id: string;
  channel_title: string;
  title: string;
  thumbnail_url: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'canceled';
  progress: number;
  speed: string;
  eta: string;
  downloaded_bytes: number;
  total_bytes: number;
  error_message?: string;
  resolution: string;
  requested_resolution?: string;
  quality_note?: string | null;
  format: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

class DownloadQueueService extends EventEmitter {
  private filling = false;
  private inFlight = new Set<string>();
  private catalogJobs = new Set<string>();
  private catalogGeneration = 0;

  constructor() {
    super();
    // Resume queue check on startup
    setTimeout(() => this.processNext(), 1000);
  }

  public getQueue(): QueueItem[] {
    const stmt = db.prepare(`
      SELECT * FROM download_queue 
      ORDER BY 
        CASE 
          WHEN status = 'downloading' THEN 1
          WHEN status = 'processing' THEN 1
          WHEN status = 'queued' THEN 2
          WHEN status = 'error' THEN 3
          ELSE 4 
        END,
        created_at DESC
      LIMIT 2000
    `);
    return stmt.all() as QueueItem[];
  }

  public addToQueue(video: {
    id: string;
    url?: string;
    title: string;
    channelTitle?: string;
    channelId?: string;
    thumbnailUrl?: string;
    resolution?: string;
  }): QueueItem {
    // Check if already in queue and not finished
    const existing = db.prepare(`
      SELECT * FROM download_queue 
      WHERE video_id = ? AND status IN ('queued', 'downloading', 'processing')
    `).get(video.id) as QueueItem | undefined;

    if (existing) {
      return existing;
    }

    const taskId = uuidv4();
    const url = video.url || `https://www.youtube.com/watch?v=${video.id}`;
    const resolution = video.resolution || '1080p';

    const insert = db.prepare(`
      INSERT INTO download_queue (
        id, video_id, url, channel_id, channel_title, title, thumbnail_url,
        status, progress, speed, eta, resolution, requested_resolution, format, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, '', '', ?, ?, 'mp4', datetime('now'))
    `);

    insert.run(
      taskId,
      video.id,
      url,
      video.channelId || '',
      video.channelTitle || 'Inconnu',
      video.title,
      video.thumbnailUrl || '',
      resolution,
      resolution
    );

    const item = db.prepare('SELECT * FROM download_queue WHERE id = ?').get(taskId) as QueueItem;
    this.emit('queue_updated', this.getQueue());
    this.processNext();
    return item;
  }

  public cancelTask(id: string) {
    const row = db.prepare('SELECT video_id FROM download_queue WHERE id = ?').get(id) as { video_id: string } | undefined;
    db.prepare(`
      UPDATE download_queue SET status = 'canceled' WHERE id = ? AND status IN ('queued', 'downloading', 'processing')
    `).run(id);
    cancelDownload(id);
    if (row?.video_id) cancelDownload(row.video_id);
    this.emit('queue_updated', this.getQueue());
  }

  public cancelAllActive(): number {
    this.catalogGeneration += 1;
    this.catalogJobs.clear();
    const rows = db.prepare(`
      SELECT id, video_id FROM download_queue WHERE status IN ('queued', 'downloading', 'processing')
    `).all() as Array<{ id: string; video_id: string }>;
    db.prepare(`
      UPDATE download_queue SET status = 'canceled' WHERE status IN ('queued', 'downloading', 'processing')
    `).run();
    for (const row of rows) {
      cancelDownload(row.id);
      if (row.video_id) cancelDownload(row.video_id);
    }
    this.emit('queue_updated', this.getQueue());
    return rows.length;
  }

  public async enqueueChannelCatalog(channelId: string): Promise<{ queued: number; skipped: number }> {
    if (!channelId || channelId.startsWith('custom_')) return { queued: 0, skipped: 0 };
    if (this.catalogJobs.has(channelId)) return { queued: 0, skipped: 0 };
    this.catalogJobs.add(channelId);
    const generation = this.catalogGeneration;

    let queued = 0;
    let skipped = 0;
    try {
      const channel = db.prepare(`
        SELECT
          c.id,
          c.title,
          COALESCE(c.handle, c.custom_url, '') as handle,
          COALESCE(s.max_resolution, ?) as max_resolution
        FROM channels c
        LEFT JOIN subscriptions s ON s.channel_id = c.id
        WHERE c.id = ?
      `).get(getSetting('default_max_resolution', '1080p'), channelId) as {
        id: string;
        title: string;
        handle: string;
        max_resolution: string;
      } | undefined;
      if (!channel) return { queued: 0, skipped: 0 };

      const handle = String(channel.handle || '').trim();
      const targetUrl = handle
        ? `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle.replace(/^\/+/, '')}`}`
        : `https://www.youtube.com/channel/${channel.id}`;
      const resolution = channel.max_resolution || '1080p';
      const pageSize = 50;
      const maxVideos = 5000;

      for (let start = 1; start <= maxVideos; start += pageSize) {
        if (generation !== this.catalogGeneration) break;
        const videos = await getChannelVideos(targetUrl, start, pageSize);
        if (!videos.length) break;
        for (const video of videos) {
          if (generation !== this.catalogGeneration) break;
          if (!video?.id) continue;
          const existing = db.prepare('SELECT is_downloaded FROM videos WHERE id = ?').get(video.id) as { is_downloaded: number } | undefined;
          if (existing?.is_downloaded === 1) {
            skipped++;
            continue;
          }
          const before = db.prepare(`
            SELECT id FROM download_queue WHERE video_id = ? AND status IN ('queued', 'downloading', 'processing')
          `).get(video.id);
          this.addToQueue({
            id: video.id,
            url: video.url,
            title: video.title,
            channelTitle: video.channel_title || video.channelTitle || channel.title,
            channelId: video.channel_id || channel.id,
            thumbnailUrl: video.thumbnail_url || video.thumbnailUrl,
            resolution,
          });
          if (before) skipped++;
          else queued++;
        }
        if (videos.length < pageSize) break;
        if (queued > 0 && queued % 25 === 0) this.emit('queue_updated', this.getQueue());
      }
      if (generation === this.catalogGeneration) {
        this.emit('queue_updated', this.getQueue());
        this.processNext();
      }
    } catch (err: any) {
      console.error(`Failed to enqueue catalog for ${channelId}:`, err.message);
    } finally {
      if (generation === this.catalogGeneration) this.catalogJobs.delete(channelId);
    }
    return { queued, skipped };
  }

  public retryTask(id: string) {
    db.prepare(`
      UPDATE download_queue SET status = 'queued', progress = 0, speed = '', eta = '', error_message = NULL, quality_note = NULL WHERE id = ?
    `).run(id);
    this.emit('queue_updated', this.getQueue());
    this.processNext();
  }

  public clearCompleted() {
    db.prepare(`
      DELETE FROM download_queue WHERE status IN ('completed', 'canceled', 'error')
    `).run();
    this.emit('queue_updated', this.getQueue());
  }

  public deleteItem(id: string) {
    db.prepare(`
      DELETE FROM download_queue WHERE id = ?
    `).run(id);
    this.emit('queue_updated', this.getQueue());
  }

  private countActive(): number {
    const row = db.prepare(`
      SELECT count(*) as count FROM download_queue WHERE status IN ('downloading', 'processing')
    `).get() as { count: number };
    return row.count;
  }

  public processNext() {
    if (this.filling) return;
    this.filling = true;
    try {
      const maxConcurrent = getConcurrentDownloads();
      while (this.countActive() < maxConcurrent) {
        const nextItem = db.prepare(`
          SELECT * FROM download_queue WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
        `).get() as QueueItem | undefined;
        if (!nextItem) break;
        if (this.inFlight.has(nextItem.id)) break;

        const claimed = db.prepare(`
          UPDATE download_queue
          SET status = 'downloading', started_at = datetime('now')
          WHERE id = ? AND status = 'queued'
        `).run(nextItem.id);
        if (claimed.changes === 0) continue;

        this.inFlight.add(nextItem.id);
        this.emit('queue_updated', this.getQueue());
        void this.runTask(nextItem).finally(() => {
          this.inFlight.delete(nextItem.id);
          setTimeout(() => this.processNext(), 400);
        });
      }
    } finally {
      this.filling = false;
    }
  }

  private async runTask(nextItem: QueueItem) {
    try {
      const current = db.prepare('SELECT status FROM download_queue WHERE id = ?').get(nextItem.id) as { status: string } | undefined;
      if (current?.status === 'canceled') {
        return;
      }

      const result = await downloadVideoWithProgress(nextItem.id, nextItem.url, {
        maxResolution: nextItem.resolution,
        onProgress: (prog) => {
          const current = db.prepare('SELECT status FROM download_queue WHERE id = ?').get(nextItem.id) as { status: string } | undefined;
          if (current?.status === 'canceled') return;
          db.prepare(`
            UPDATE download_queue 
            SET progress = ?, speed = ?, eta = ?, downloaded_bytes = ?, total_bytes = ?, status = ?
            WHERE id = ? AND status IN ('downloading', 'processing', 'queued')
          `).run(
            prog.percent,
            prog.speed,
            prog.eta,
            prog.downloadedBytes,
            prog.totalBytes,
            prog.status.includes('Traitement') ? 'processing' : 'downloading',
            nextItem.id
          );

          this.emit('task_progress', {
            id: nextItem.id,
            progress: prog.percent,
            speed: prog.speed,
            eta: prog.eta,
            status: prog.status,
          });
        },
      });

      const after = db.prepare('SELECT status FROM download_queue WHERE id = ?').get(nextItem.id) as { status: string } | undefined;
      if (after?.status === 'canceled') {
        return;
      }

      if (!result.videoPath) {
        throw new Error('Fichier vidéo introuvable après téléchargement');
      }

      const meta = result.metadata || {};
      const images = pickChannelImages(meta);
      const duration = meta.duration || 0;
      const channelId = meta.channel_id || nextItem.channel_id || '';
      const channelTitle = meta.channel || meta.uploader || nextItem.channel_title || 'Chaîne Inconnue';

      if (channelId) {
        db.prepare(`
          INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, language, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
            banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
            language = COALESCE(NULLIF(excluded.language, ''), channels.language),
            updated_at = datetime('now')
        `).run(
          channelId,
          channelTitle,
          meta.uploader_id ? `@${meta.uploader_id}` : '',
          meta.channel_description || '',
          images.avatarUrl || meta.channel_avatar || '',
          images.bannerUrl || meta.channel_banner || '',
          pickContentLanguage(meta)
        );

        // Asynchronously fetch complete channel banner & high-res avatar if missing
        getChannelDetails(channelId, isLocalOnly() ? 1 : 50).then((chDetails) => {
          if (chDetails) {
            db.prepare(`
              UPDATE channels 
              SET avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                  banner_url = COALESCE(NULLIF(?, ''), banner_url),
                  description = COALESCE(NULLIF(?, ''), description),
                  subscriber_count = COALESCE(NULLIF(?, ''), subscriber_count),
                  handle = COALESCE(NULLIF(?, ''), handle),
                  language = COALESCE(NULLIF(?, ''), language),
                  updated_at = datetime('now')
              WHERE id = ?
            `).run(
              chDetails.avatarUrl || '',
              chDetails.bannerUrl || '',
              chDetails.description || '',
              chDetails.subscriberCount || '',
              chDetails.handle || '',
              chDetails.language || '',
              channelId
            );
          }
        }).catch(() => {});
      }

      // Convert local absolute paths to relative web paths for streaming
      const relVideoPath = result.videoPath ? path.relative(DOWNLOADS_DIR, result.videoPath).replace(/\\/g, '/') : '';
      const relThumbPath = result.thumbnailPath ? path.relative(DOWNLOADS_DIR, result.thumbnailPath).replace(/\\/g, '/') : '';
      const relJsonPath = result.jsonPath ? path.relative(DOWNLOADS_DIR, result.jsonPath).replace(/\\/g, '/') : '';

      const fileSize = result.videoPath && fs.existsSync(result.videoPath) ? fs.statSync(result.videoPath).size : 0;
      const probedHeight = result.videoPath ? await probeVideoHeight(result.videoPath) : null;
      const metaHeight = Number(meta.height);
      const actualHeight = probedHeight || (Number.isFinite(metaHeight) && metaHeight > 0 ? metaHeight : 0);
      const storedResolution = actualHeight
        ? qualityLabelFromHeight(actualHeight)
        : resolutionLabelFromMetadata(meta, nextItem.resolution);
      const requestedResolution = nextItem.requested_resolution || nextItem.resolution;
      const qualityNote = actualHeight ? encodeQualityNote(requestedResolution, actualHeight) : null;

      db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, description, duration, duration_string,
          view_count, upload_date, thumbnail_url, local_thumbnail_path, local_video_path,
          local_json_path, file_size, resolution, is_downloaded, downloaded_at, language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?)
        ON CONFLICT(id) DO UPDATE SET
          local_video_path = excluded.local_video_path,
          local_thumbnail_path = excluded.local_thumbnail_path,
          local_json_path = excluded.local_json_path,
          file_size = excluded.file_size,
          resolution = excluded.resolution,
          is_downloaded = 1,
          downloaded_at = datetime('now'),
          language = COALESCE(NULLIF(excluded.language, ''), videos.language)
      `).run(
        nextItem.video_id,
        channelId,
        channelTitle,
        meta.title || nextItem.title,
        meta.description || '',
        duration,
        formatDuration(duration),
        meta.view_count || 0,
        meta.upload_date || '',
        meta.thumbnail || nextItem.thumbnail_url,
        relThumbPath,
        relVideoPath,
        relJsonPath,
        fileSize,
        storedResolution,
        pickContentLanguage(meta)
      );

      rememberFetchedVideo({
        id: nextItem.video_id,
        title: meta.title || nextItem.title,
        description: meta.description || '',
        channelTitle,
        language: pickContentLanguage(meta),
      });
      if (channelId) {
        rememberFetchedChannel({
          id: channelId,
          title: channelTitle,
          description: meta.channel_description || '',
          language: pickContentLanguage(meta),
        });
      }

      // Mark queue as completed
      db.prepare(`
        UPDATE download_queue 
        SET status = 'completed', progress = 100, completed_at = datetime('now'),
            resolution = ?, quality_note = ?
        WHERE id = ?
      `).run(storedResolution, qualityNote, nextItem.id);

      // Auto-purge any previous failed error tasks for the same video
      try {
        db.prepare(`
          DELETE FROM download_queue 
          WHERE (video_id = ? OR id != ?) AND video_id = ? AND status = 'error'
        `).run(nextItem.video_id, nextItem.id, nextItem.video_id);
      } catch (_) {}

      this.emit('task_completed', {
        id: nextItem.id,
        videoId: nextItem.video_id,
        title: meta.title || nextItem.title,
        requestedResolution,
        actualResolution: storedResolution,
        qualityNote,
      });
      this.emit('queue_updated', this.getQueue());

    } catch (err: any) {
      const current = db.prepare('SELECT status FROM download_queue WHERE id = ?').get(nextItem.id) as { status: string } | undefined;
      if (current?.status === 'canceled' || /canceled|annulé/i.test(String(err?.message || ''))) {
        return;
      }
      let cleanMessage = err.message || 'Erreur inconnue';
      if (/HTTP Error 403|403: Forbidden/i.test(cleanMessage)) {
        cleanMessage = 'YouTube a refusé le téléchargement (403). Réessaie, ou ajoute des cookies YouTube dans Paramètres.';
      } else if (/page needs to be reloaded|UNPLAYABLE/i.test(cleanMessage)) {
        cleanMessage = 'YouTube a bloqué ce lecteur. Mets à jour yt-dlp dans Paramètres, puis réessaie.';
      } else if (cleanMessage.includes('ERROR:')) {
        const errorPart = cleanMessage.split('ERROR:').pop()?.trim();
        if (errorPart) cleanMessage = errorPart;
      }

      console.error(`Download task ${nextItem.id} failed:`, cleanMessage);
      db.prepare(`
        UPDATE download_queue 
        SET status = 'error', error_message = ? 
        WHERE id = ?
      `).run(cleanMessage, nextItem.id);

      this.emit('task_failed', { id: nextItem.id, error: cleanMessage });
      this.emit('queue_updated', this.getQueue());
    }
  }
}

export const downloadQueue = new DownloadQueueService();
