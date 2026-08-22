import cron, { ScheduledTask } from 'node-cron';
import { db } from '../db/database.js';
import { getChannelDetails, getVideoDetails, formatDuration, updateYtDlp } from './ytdlp.js';
import { downloadQueue } from './queue.js';
import { isLocalOnly, isScanEnabled } from '../utils/settings.js';
import { trimSubscribedChannelCatalog, materializeChannelBranding, prefetchCatalogThumbs } from '../utils/remoteImages.js';
import { isYouTubeVideoId } from '../utils/youtube.js';

const SCAN_PLAYLIST_CAP = 100;

type ScanTarget = {
  id: string;
  title: string;
  handle: string;
  autoDownload: number;
  maxResolution: string;
  isSubscribed: boolean;
};

function channelUrl(target: ScanTarget): string {
  const handle = String(target.handle || '').trim();
  if (handle) {
    const slug = handle.startsWith('@') ? handle : `@${handle.replace(/^\/+/, '')}`;
    return `https://www.youtube.com/${slug}`;
  }
  return `https://www.youtube.com/channel/${target.id}`;
}

function collectScanTargets(): ScanTarget[] {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.title,
      COALESCE(c.handle, c.custom_url, '') as handle,
      COALESCE(s.auto_download, 0) as auto_download,
      COALESCE(s.max_resolution, '1080p') as max_resolution,
      CASE WHEN s.channel_id IS NOT NULL THEN 1 ELSE 0 END as is_subscribed
    FROM channels c
    LEFT JOIN subscriptions s ON s.channel_id = c.id
    WHERE c.id NOT LIKE 'custom_%'
      AND (
        s.channel_id IS NOT NULL
        OR c.is_owner = 1
        OR c.id IN (
          SELECT linked_youtube_id FROM channels
          WHERE linked_youtube_id IS NOT NULL AND linked_youtube_id != ''
        )
        OR c.id IN (
          SELECT DISTINCT channel_id FROM videos
          WHERE is_downloaded = 1
            AND channel_id IS NOT NULL
            AND channel_id NOT LIKE 'custom_%'
        )
      )
  `).all() as Array<{
    id: string;
    title: string;
    handle: string;
    auto_download: number;
    max_resolution: string;
    is_subscribed: number;
  }>;

  const byId = new Map<string, ScanTarget>();
  for (const row of rows) {
    if (!row.id || String(row.id).startsWith('custom_')) continue;
    byId.set(row.id, {
      id: row.id,
      title: row.title || row.id,
      handle: row.handle || '',
      autoDownload: row.auto_download || 0,
      maxResolution: row.max_resolution || '1080p',
      isSubscribed: row.is_subscribed === 1,
    });
  }
  return [...byId.values()];
}

function upsertChannel(details: any, images: { avatarUrl?: string; bannerUrl?: string }) {
  if (!details?.id) return;
  db.prepare(`
    INSERT INTO channels (
      id, title, handle, description, avatar_url, banner_url,
      subscriber_count, video_count, language, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = COALESCE(NULLIF(excluded.title, ''), channels.title),
      handle = COALESCE(NULLIF(excluded.handle, ''), channels.handle),
      description = COALESCE(NULLIF(excluded.description, ''), channels.description),
      avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), channels.avatar_url),
      banner_url = COALESCE(NULLIF(excluded.banner_url, ''), channels.banner_url),
      subscriber_count = COALESCE(NULLIF(excluded.subscriber_count, ''), channels.subscriber_count),
      video_count = CASE WHEN excluded.video_count > IFNULL(channels.video_count, 0) THEN excluded.video_count ELSE channels.video_count END,
      language = COALESCE(NULLIF(excluded.language, ''), channels.language),
      updated_at = datetime('now')
  `).run(
    details.id,
    details.title || details.id,
    details.handle || '',
    details.description || '',
    images.avatarUrl || details.avatarUrl || '',
    images.bannerUrl || details.bannerUrl || '',
    details.subscriberCount || '',
    Number(details.videoCount) || 0,
    details.language || '',
  );

  if (details.title) {
    db.prepare(`
      UPDATE videos SET channel_title = ? WHERE channel_id = ? AND IFNULL(channel_title, '') != ?
    `).run(details.title, details.id, details.title);
  }
}

function upsertCatalogVideo(video: any, channelId: string, channelTitle: string): 'inserted' | 'updated' | 'skipped' {
  if (!video?.id) return 'skipped';
  const existing = db.prepare('SELECT id FROM videos WHERE id = ?').get(video.id) as { id: string } | undefined;
  db.prepare(`
    INSERT INTO videos (
      id, channel_id, channel_title, title, description, duration, duration_string,
      upload_date, thumbnail_url, view_count, is_downloaded, language, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      channel_id = COALESCE(NULLIF(excluded.channel_id, ''), videos.channel_id),
      channel_title = COALESCE(NULLIF(excluded.channel_title, ''), videos.channel_title),
      title = COALESCE(NULLIF(excluded.title, ''), videos.title),
      description = COALESCE(NULLIF(excluded.description, ''), videos.description),
      duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE videos.duration END,
      duration_string = COALESCE(NULLIF(excluded.duration_string, ''), videos.duration_string),
      upload_date = COALESCE(NULLIF(excluded.upload_date, ''), videos.upload_date),
      thumbnail_url = COALESCE(NULLIF(excluded.thumbnail_url, ''), videos.thumbnail_url),
      language = COALESCE(NULLIF(excluded.language, ''), videos.language),
      view_count = CASE WHEN excluded.view_count > 0 THEN excluded.view_count ELSE videos.view_count END,
      updated_at = datetime('now')
  `).run(
    video.id,
    channelId,
    channelTitle,
    video.title || 'Vidéo',
    video.description || '',
    video.duration || 0,
    video.durationString || formatDuration(video.duration),
    video.uploadDate || '',
    video.thumbnailUrl || '',
    video.viewCount || 0,
    video.language || '',
  );
  return existing ? 'updated' : 'inserted';
}

function applyVideoDetails(details: any) {
  if (!details?.id) return;
  db.prepare(`
    UPDATE videos SET
      title = COALESCE(NULLIF(?, ''), title),
      description = COALESCE(NULLIF(?, ''), description),
      duration = CASE WHEN ? > 0 THEN ? ELSE duration END,
      duration_string = COALESCE(NULLIF(?, ''), duration_string),
      view_count = CASE WHEN ? > 0 THEN ? ELSE view_count END,
      upload_date = COALESCE(NULLIF(?, ''), upload_date),
      thumbnail_url = COALESCE(NULLIF(?, ''), thumbnail_url),
      language = COALESCE(NULLIF(?, ''), language),
      channel_title = COALESCE(NULLIF(?, ''), channel_title),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    details.title || '',
    details.description || '',
    details.duration || 0,
    details.duration || 0,
    details.durationString || '',
    details.viewCount || 0,
    details.viewCount || 0,
    details.uploadDate || '',
    details.thumbnailUrl || '',
    details.language || '',
    details.channelTitle || '',
    details.id,
  );
}

function intervalToCron(minutesRaw: number): string {
  const minutes = Math.max(15, Math.min(24 * 60, Math.round(minutesRaw) || 60));
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 1) return '0 * * * *';
    return `0 */${hours} * * *`;
  }
  return `*/${minutes} * * * *`;
}

class ChannelScannerService {
  private isScanning = false;
  private cronJob: ScheduledTask | null = null;
  private ytdlpCron: ScheduledTask | null = null;

  constructor() {
    this.initCron();
  }

  public initCron() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    if (this.ytdlpCron) {
      this.ytdlpCron.stop();
    }

    let interval = 60;
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_scan_interval') as { value: string } | undefined;
      interval = parseInt(row?.value || '60', 10);
    } catch (_) {}

    const expr = intervalToCron(interval);
    this.cronJob = cron.schedule(expr, async () => {
      console.log('Auto scanner cron triggered');
      await this.scanAllSubscriptions();
    });

    this.ytdlpCron = cron.schedule('15 4 * * 0', async () => {
      try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('auto_update_ytdlp') as { value: string } | undefined;
        if (row?.value === 'false') return;
        const result = await updateYtDlp();
        console.log('Weekly yt-dlp update:', result.message);
      } catch (err: any) {
        console.warn('Weekly yt-dlp update failed:', err.message);
      }
    });
  }

  public async scanAllSubscriptions(options?: { forceFull?: boolean }): Promise<{ scanned: number; newVideosFound: number; updatedVideos: number }> {
    if (this.isScanning || isLocalOnly()) {
      return { scanned: 0, newVideosFound: 0, updatedVideos: 0 };
    }

    const fullScan = options?.forceFull === true || isScanEnabled();
    const allTargets = collectScanTargets();
    const targets = fullScan ? allTargets : allTargets.filter((target) => target.autoDownload === 1);

    if (targets.length === 0) {
      return { scanned: 0, newVideosFound: 0, updatedVideos: 0 };
    }

    this.isScanning = true;
    console.log(fullScan
      ? '🔍 Starting library scan (subscriptions, linked channels, downloaded videos)...'
      : `⚡ Quiet auto-download scan (${targets.length} channel(s))...`);

    let scannedCount = 0;
    let newVideosTotal = 0;
    let updatedVideos = 0;

    try {
      for (const target of targets) {
        try {
          console.log(`📡 Scanning channel: ${target.title} (${target.id})...`);
          const details = await getChannelDetails(channelUrl(target), SCAN_PLAYLIST_CAP);
          scannedCount++;

          const channelId = details.id || target.id;
          const channelTitle = details.title || target.title;
          const images = await materializeChannelBranding(channelId, details.avatarUrl || '', details.bannerUrl || '');
          const videos = details.videos || [];
          prefetchCatalogThumbs(videos.map((v: any) => v.id));
          upsertChannel(details, images);

          for (const v of videos) {
            if (!v.id) continue;
            const result = upsertCatalogVideo(v, channelId, channelTitle);
            if (result === 'inserted') {
              newVideosTotal++;
              if (target.isSubscribed && target.autoDownload === 1) {
                console.log(`⚡ Auto-queuing new video: ${v.title} (${v.id})`);
                downloadQueue.addToQueue({
                  id: v.id,
                  url: v.url,
                  title: v.title,
                  channelTitle,
                  channelId,
                  thumbnailUrl: v.thumbnailUrl,
                  resolution: target.maxResolution || '1080p',
                });
              }
            } else if (result === 'updated') {
              updatedVideos++;
            }
          }

          if (target.isSubscribed) {
            db.prepare(`
              UPDATE subscriptions SET last_scanned_at = datetime('now') WHERE channel_id = ?
            `).run(target.id);
          }
        } catch (subErr: any) {
          console.error(`Error scanning channel ${target.id}:`, subErr.message);
        }
      }

      if (fullScan) {
        const downloaded = db.prepare(`
          SELECT id, title FROM videos
          WHERE is_downloaded = 1
            AND id NOT LIKE 'custom_%'
        `).all() as Array<{ id: string; title: string }>;

        for (const video of downloaded) {
          if (!isYouTubeVideoId(video.id)) continue;
          try {
            console.log(`🔄 Refreshing downloaded video: ${video.title} (${video.id})`);
            const details = await getVideoDetails(video.id);
            applyVideoDetails(details);
            updatedVideos++;
          } catch (videoErr: any) {
            console.warn(`Could not refresh ${video.id}: ${videoErr.message}`);
          }
        }

        this.cleanupEphemeralCache();
      }

      console.log(`✅ Scan finished: ${scannedCount} channels, ${newVideosTotal} new videos, ${updatedVideos} metadata updates.`);
    } catch (err: any) {
      console.error('Scan failed:', err.message);
    } finally {
      this.isScanning = false;
    }

    return { scanned: scannedCount, newVideosFound: newVideosTotal, updatedVideos };
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

      const trimmedSubs = trimSubscribedChannelCatalog();

      if (deletedVideos.changes > 0 || deletedChannels.changes > 0 || trimmedSubs > 0) {
        console.log(`🧹 Cache cleanup: purged ${deletedVideos.changes} ephemeral videos, ${deletedChannels.changes} ephemeral channels, trimmed ${trimmedSubs} old subscription rows.`);
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
