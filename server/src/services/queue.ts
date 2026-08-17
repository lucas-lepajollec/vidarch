import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database.js';
import { downloadVideoWithProgress, formatDuration, getChannelDetails } from './ytdlp.js';
import { DOWNLOADS_DIR } from '../config.js';

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
  format: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

class DownloadQueueService extends EventEmitter {
  private isProcessing = false;
  private maxConcurrent = 1;

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
          WHEN status = 'queued' THEN 2
          WHEN status = 'error' THEN 3
          ELSE 4 
        END,
        created_at DESC
      LIMIT 100
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
      WHERE video_id = ? AND status IN ('queued', 'downloading')
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
        status, progress, speed, eta, resolution, format, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, '', '', ?, 'mp4', datetime('now'))
    `);

    insert.run(
      taskId,
      video.id,
      url,
      video.channelId || '',
      video.channelTitle || 'Inconnu',
      video.title,
      video.thumbnailUrl || '',
      resolution
    );

    const item = db.prepare('SELECT * FROM download_queue WHERE id = ?').get(taskId) as QueueItem;
    this.emit('queue_updated', this.getQueue());
    this.processNext();
    return item;
  }

  public cancelTask(id: string) {
    db.prepare(`
      UPDATE download_queue SET status = 'canceled' WHERE id = ? AND status IN ('queued', 'downloading')
    `).run(id);
    this.emit('queue_updated', this.getQueue());
  }

  public retryTask(id: string) {
    db.prepare(`
      UPDATE download_queue SET status = 'queued', progress = 0, speed = '', eta = '', error_message = NULL WHERE id = ?
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

  private async processNext() {
    if (this.isProcessing) return;

    // Check active downloads
    const active = db.prepare(`
      SELECT count(*) as count FROM download_queue WHERE status = 'downloading'
    `).get() as { count: number };

    if (active.count >= this.maxConcurrent) return;

    // Pick next queued item
    const nextItem = db.prepare(`
      SELECT * FROM download_queue WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1
    `).get() as QueueItem | undefined;

    if (!nextItem) return;

    this.isProcessing = true;

    try {
      // Mark as downloading
      db.prepare(`
        UPDATE download_queue 
        SET status = 'downloading', started_at = datetime('now') 
        WHERE id = ?
      `).run(nextItem.id);

      this.emit('queue_updated', this.getQueue());

      const result = await downloadVideoWithProgress(nextItem.id, nextItem.url, {
        maxResolution: nextItem.resolution,
        onProgress: (prog) => {
          db.prepare(`
            UPDATE download_queue 
            SET progress = ?, speed = ?, eta = ?, downloaded_bytes = ?, total_bytes = ?, status = ?
            WHERE id = ?
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

      // Save video to database
      const meta = result.metadata || {};
      const duration = meta.duration || 0;
      const channelId = meta.channel_id || nextItem.channel_id || '';
      const channelTitle = meta.channel || meta.uploader || nextItem.channel_title || 'Chaîne Inconnue';

      // Insert or update channel
      if (channelId) {
        db.prepare(`
          INSERT INTO channels (id, title, handle, description, avatar_url, banner_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
            banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
            updated_at = datetime('now')
        `).run(
          channelId,
          channelTitle,
          meta.uploader_id ? `@${meta.uploader_id}` : '',
          meta.channel_description || '',
          meta.channel_avatar || '',
          meta.channel_banner || ''
        );

        // Asynchronously fetch complete channel banner & high-res avatar if missing
        getChannelDetails(channelId).then((chDetails) => {
          if (chDetails) {
            db.prepare(`
              UPDATE channels 
              SET avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                  banner_url = COALESCE(NULLIF(?, ''), banner_url),
                  description = COALESCE(NULLIF(?, ''), description),
                  subscriber_count = COALESCE(NULLIF(?, ''), subscriber_count),
                  handle = COALESCE(NULLIF(?, ''), handle),
                  updated_at = datetime('now')
              WHERE id = ?
            `).run(
              chDetails.avatarUrl || '',
              chDetails.bannerUrl || '',
              chDetails.description || '',
              chDetails.subscriberCount || '',
              chDetails.handle || '',
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

      db.prepare(`
        INSERT INTO videos (
          id, channel_id, channel_title, title, description, duration, duration_string,
          view_count, upload_date, thumbnail_url, local_thumbnail_path, local_video_path,
          local_json_path, file_size, resolution, is_downloaded, downloaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          local_video_path = excluded.local_video_path,
          local_thumbnail_path = excluded.local_thumbnail_path,
          local_json_path = excluded.local_json_path,
          file_size = excluded.file_size,
          is_downloaded = 1,
          downloaded_at = datetime('now')
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
        meta.resolution || nextItem.resolution
      );

      // Mark queue as completed
      db.prepare(`
        UPDATE download_queue 
        SET status = 'completed', progress = 100, completed_at = datetime('now') 
        WHERE id = ?
      `).run(nextItem.id);

      // Auto-purge any previous failed error tasks for the same video
      try {
        db.prepare(`
          DELETE FROM download_queue 
          WHERE (video_id = ? OR id != ?) AND video_id = ? AND status = 'error'
        `).run(nextItem.video_id, nextItem.id, nextItem.video_id);
      } catch (_) {}

      this.emit('task_completed', { id: nextItem.id, videoId: nextItem.video_id });
      this.emit('queue_updated', this.getQueue());

    } catch (err: any) {
      let cleanMessage = err.message || 'Erreur inconnue';
      if (cleanMessage.includes('HTTP Error 403: Forbidden')) {
        cleanMessage = 'HTTP 403: Accès vidéo restreint par YouTube';
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
    } finally {
      this.isProcessing = false;
      // Continue next item
      setTimeout(() => this.processNext(), 500);
    }
  }
}

export const downloadQueue = new DownloadQueueService();
