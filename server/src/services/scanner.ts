import cron, { ScheduledTask } from 'node-cron';
import { db } from '../db/database.js';
import { getChannelDetails, formatDuration } from './ytdlp.js';
import { downloadQueue } from './queue.js';

class ChannelScannerService {
  private isScanning = false;
  private cronJob: ScheduledTask | null = null;

  constructor() {
    this.initCron();
  }

  public initCron() {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Default: run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Auto scanner cron triggered');
      await this.scanAllSubscriptions();
    });
  }

  public async scanAllSubscriptions(): Promise<{ scanned: number; newVideosFound: number }> {
    if (this.isScanning) {
      return { scanned: 0, newVideosFound: 0 };
    }

    this.isScanning = true;
    console.log('🔍 Starting subscriptions scan...');

    let scannedCount = 0;
    let newVideosTotal = 0;

    try {
      const subs = db.prepare(`
        SELECT s.*, c.title as channel_title, c.handle, c.custom_url 
        FROM subscriptions s
        JOIN channels c ON s.channel_id = c.id
      `).all() as any[];

      for (const sub of subs) {
        try {
          console.log(`📡 Scanning channel: ${sub.channel_title} (${sub.channel_id})...`);
          
          const channelUrl = sub.handle 
            ? `https://www.youtube.com/${sub.handle}`
            : `https://www.youtube.com/channel/${sub.channel_id}`;

          const details = await getChannelDetails(channelUrl);
          scannedCount++;

          // Update channel metadata (avatar, banner, subscribers)
          db.prepare(`
            UPDATE channels 
            SET avatar_url = COALESCE(?, avatar_url),
                banner_url = COALESCE(?, banner_url),
                subscriber_count = COALESCE(?, subscriber_count),
                updated_at = datetime('now')
            WHERE id = ?
          `).run(details.avatarUrl, details.bannerUrl, details.subscriberCount, sub.channel_id);

          // Check videos
          const videos = details.videos || [];
          for (const v of videos) {
            if (!v.id) continue;

            // Check if video already exists in db
            const existing = db.prepare('SELECT id, is_downloaded FROM videos WHERE id = ?').get(v.id) as any;

            if (!existing) {
              newVideosTotal++;
              // Insert as non-downloaded video in feed
              db.prepare(`
                INSERT INTO videos (
                  id, channel_id, channel_title, title, duration, duration_string,
                  upload_date, thumbnail_url, view_count, is_downloaded
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `).run(
                v.id,
                sub.channel_id,
                sub.channel_title,
                v.title,
                v.duration,
                v.durationString || formatDuration(v.duration),
                v.uploadDate,
                v.thumbnailUrl,
                v.viewCount
              );

              // If channel has auto_download enabled, queue the video!
              if (sub.auto_download === 1) {
                console.log(`⚡ Auto-queuing new video: ${v.title} (${v.id})`);
                downloadQueue.addToQueue({
                  id: v.id,
                  url: v.url,
                  title: v.title,
                  channelTitle: sub.channel_title,
                  channelId: sub.channel_id,
                  thumbnailUrl: v.thumbnailUrl,
                  resolution: sub.max_resolution || '1080p',
                });
              }
            }
          }

          // Update subscription last scanned
          db.prepare(`
            UPDATE subscriptions SET last_scanned_at = datetime('now') WHERE channel_id = ?
          `).run(sub.channel_id);

        } catch (subErr: any) {
          console.error(`Error scanning channel ${sub.channel_id}:`, subErr.message);
        }
      }

      console.log(`✅ Scan finished: ${scannedCount} channels scanned, ${newVideosTotal} new videos found.`);

      // Periodic cleanup of ephemeral search and un-subscribed cache
      this.cleanupEphemeralCache();
    } catch (err: any) {
      console.error('Scan failed:', err.message);
    } finally {
      this.isScanning = false;
    }

    return { scanned: scannedCount, newVideosFound: newVideosTotal };
  }

  public cleanupEphemeralCache() {
    try {
      // 1. Delete videos that are NOT downloaded, NOT liked, have NO watch progress,
      // and belong to a channel that is NOT subscribed, older than 7 days
      const deletedVideos = db.prepare(`
        DELETE FROM videos 
        WHERE is_downloaded = 0 
          AND liked = 0 
          AND watch_progress = 0 
          AND last_watched_at IS NULL
          AND (channel_id IS NULL OR channel_id NOT IN (SELECT channel_id FROM subscriptions))
          AND datetime(created_at) < datetime('now', '-7 days')
      `).run();

      // 2. Delete channels that are NOT subscribed, and have NO downloaded/liked/watched videos
      const deletedChannels = db.prepare(`
        DELETE FROM channels 
        WHERE id NOT IN (SELECT channel_id FROM subscriptions)
          AND id NOT IN (SELECT channel_id FROM videos WHERE is_downloaded = 1 OR liked = 1 OR watch_progress > 0 OR last_watched_at IS NOT NULL)
          AND datetime(updated_at) < datetime('now', '-7 days')
      `).run();

      // 3. Keep only the 100 most recent search query entries
      db.prepare(`
        DELETE FROM search_history 
        WHERE id NOT IN (
          SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 100
        )
      `).run();

      // 4. Keep only the 100 most recent search videos
      db.prepare(`
        DELETE FROM recent_search_videos 
        WHERE id NOT IN (
          SELECT id FROM recent_search_videos ORDER BY searched_at DESC LIMIT 100
        )
      `).run();

      if (deletedVideos.changes > 0 || deletedChannels.changes > 0) {
        console.log(`🧹 Cache cleanup: purged ${deletedVideos.changes} ephemeral videos and ${deletedChannels.changes} ephemeral channels.`);
      }
    } catch (err: any) {
      console.error('Error during cache cleanup:', err.message);
    }
  }

  public getStatus() {
    return {
      isScanning: this.isScanning,
    };
  }
}

export const scannerService = new ChannelScannerService();
