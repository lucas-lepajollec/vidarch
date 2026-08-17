import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { findYtDlpPath, DOWNLOADS_DIR, COOKIES_FILE } from '../config.js';
import { db } from '../db/database.js';

const execAsync = promisify(exec);

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function getYtDlpVersion(): Promise<string> {
  const ytDlp = findYtDlpPath();
  try {
    const { stdout } = await execAsync(`"${ytDlp}" --version`);
    return stdout.trim();
  } catch (err: any) {
    console.error('Error getting yt-dlp version:', err.message);
    return 'Non disponible';
  }
}

export async function updateYtDlp(): Promise<{ success: boolean; message: string }> {
  const ytDlp = findYtDlpPath();
  try {
    const { stdout } = await execAsync(`"${ytDlp}" -U`);
    return { success: true, message: stdout.trim() };
  } catch (err: any) {
    // Fallback: try python pip upgrade
    try {
      const { stdout } = await execAsync(`python -m pip install --upgrade yt-dlp`);
      return { success: true, message: stdout.trim() };
    } catch (pipErr: any) {
      return { success: false, message: err.message || pipErr.message };
    }
  }
}

export interface YouTubeSearchResult {
  id: string;
  type: 'video' | 'channel';
  title: string;
  channelTitle?: string;
  channelId?: string;
  duration?: number;
  durationString?: string;
  thumbnailUrl?: string;
  url: string;
  description?: string;
  viewCount?: number;
  uploadDate?: string;
  avatarUrl?: string;
}

export const DEFAULT_LANG_ARGS = [
  '--extractor-args', 'youtube:player_client=android,web',
  '--no-check-certificates',
  '--js-runtimes', 'node',
  '--add-header', 'Accept-Language: fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
];

export async function searchYouTube(query: string, limit = 15): Promise<YouTubeSearchResult[]> {
  const ytDlp = findYtDlpPath();
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Check if query is a direct URL
  const isDirectUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('www.');
  const searchArg = isDirectUrl ? trimmed : `ytsearch${limit}:${trimmed}`;

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    ...DEFAULT_LANG_ARGS,
  ];

  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(searchArg);

  return new Promise((resolve) => {
    const proc = spawn(ytDlp, args);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !output) {
        console.error('yt-dlp search error:', errorOutput);
        return resolve([]);
      }

      try {
        const json = JSON.parse(output);
        const results: YouTubeSearchResult[] = [];

        // Handle single video or playlist or search results
        const entries = json.entries || [json];

        for (const item of entries) {
          if (!item) continue;

          const isChannel = item._type === 'playlist' && (item.channel_id || item.uploader_id || item.url?.includes('/channel/') || item.url?.includes('/@'));
          
          let thumbnailUrl = item.thumbnail || (item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[item.thumbnails.length - 1].url : '');
          if (!thumbnailUrl && item.id) {
            thumbnailUrl = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
          }

          results.push({
            id: item.id || item.url || '',
            type: isChannel ? 'channel' : 'video',
            title: item.title || item.channel || 'Sans titre',
            channelTitle: item.channel || item.uploader || item.uploader_id || '',
            channelId: item.channel_id || item.uploader_id || '',
            duration: item.duration || 0,
            durationString: item.duration ? formatDuration(item.duration) : '',
            thumbnailUrl,
            url: item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : ''),
            description: item.description || '',
            viewCount: item.view_count || 0,
            uploadDate: item.upload_date || '',
          });
        }

        resolve(results);
      } catch (err: any) {
        console.error('Failed to parse yt-dlp JSON:', err.message);
        resolve([]);
      }
    });
  });
}

export async function getChannelDetails(channelUrlOrHandle: string, maxItems = 50): Promise<any> {
  const ytDlp = findYtDlpPath();
  
  let targetUrl = channelUrlOrHandle.trim();
  if (!targetUrl.startsWith('http')) {
    if (targetUrl.startsWith('UC') || targetUrl.startsWith('HC')) {
      targetUrl = `https://www.youtube.com/channel/${targetUrl}/videos`;
    } else if (targetUrl.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${targetUrl}/videos`;
    } else {
      targetUrl = `https://www.youtube.com/@${targetUrl}/videos`;
    }
  } else if (!targetUrl.endsWith('/videos') && !targetUrl.includes('/watch')) {
    targetUrl = `${targetUrl}/videos`;
  }

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    ...DEFAULT_LANG_ARGS,
  ];

  if (maxItems && maxItems > 0) {
    args.push('--playlist-items', `1-${maxItems}`);
  }

  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(targetUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, args);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !output) {
        return reject(new Error(errorOutput || 'Erreur lors de la récupération de la chaîne'));
      }

      try {
        if (!output || !output.trim()) {
          return reject(new Error(errorOutput || 'Réponse vide de yt-dlp'));
        }
        const json = JSON.parse(output.trim());
        if (!json || typeof json !== 'object') {
          return reject(new Error('Données de chaîne non reconnues'));
        }

        const channelId = json.channel_id || json.id || json.uploader_id;
        const channelTitle = json.channel || json.uploader || json.title || 'Chaîne YouTube';
        const description = json.description || '';
        
        let avatarUrl = json.channel_avatar || json.avatar || '';
        let bannerUrl = json.banner_url || json.banner || '';

        if (json.thumbnails && Array.isArray(json.thumbnails)) {
          for (const t of json.thumbnails) {
            if (!t.url) continue;
            // 1. Check by ID
            if (t.id === 'avatar_uncropped' || (t.id && String(t.id).includes('avatar'))) {
              avatarUrl = t.url;
            } else if (t.id === 'banner_uncropped' || (t.id && String(t.id).includes('banner'))) {
              bannerUrl = t.url;
            }
            // 2. Check by square aspect ratio for avatar (1:1, e.g. 900x900)
            if (!avatarUrl && t.width && t.height && t.width === t.height) {
              avatarUrl = t.url;
            }
            // 3. Check by wide banner aspect ratio (e.g. 2560x424, aspect > 2.5)
            if (!bannerUrl && t.width && t.height && (t.width / t.height) > 2.5) {
              bannerUrl = t.url;
            }
          }
          // Fallback if avatar still empty
          if (!avatarUrl) {
            const squareThumb = json.thumbnails.find((t: any) => t.url && t.url.includes('-c-k-c0x00ffffff'));
            if (squareThumb) avatarUrl = squareThumb.url;
            else if (json.thumbnails[json.thumbnails.length - 1]?.url) {
              avatarUrl = json.thumbnails[json.thumbnails.length - 1].url;
            }
          }
        }

        const videos = (json.entries || []).map((v: any) => ({
          id: v.id,
          title: v.title || 'Vidéo',
          duration: v.duration || 0,
          durationString: v.duration ? formatDuration(v.duration) : '',
          uploadDate: v.upload_date || '',
          viewCount: v.view_count || 0,
          thumbnailUrl: v.thumbnail || (v.thumbnails?.length ? v.thumbnails[v.thumbnails.length - 1].url : `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`),
          url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
        }));

        resolve({
          id: channelId,
          title: channelTitle,
          handle: json.uploader_id ? `@${json.uploader_id.replace(/^@/, '')}` : (json.channel_id ? `@${channelTitle.replace(/\s+/g, '')}` : ''),
          description,
          avatarUrl,
          bannerUrl,
          subscriberCount: json.channel_follower_count ? `${json.channel_follower_count} abonnés` : '',
          videoCount: json.playlist_count || (json.entries?.length || 0),
          videos,
          url: targetUrl,
        });
      } catch (err: any) {
        console.error('Failed to parse channel JSON:', err.message);
        reject(err);
      }
    });
  });
}

export async function getChannelVideos(channelUrlOrHandle: string, startIndex = 1, count = 50): Promise<any[]> {
  const ytDlp = findYtDlpPath();
  
  let targetUrl = channelUrlOrHandle.trim();
  if (!targetUrl.startsWith('http')) {
    if (targetUrl.startsWith('UC') || targetUrl.startsWith('HC')) {
      targetUrl = `https://www.youtube.com/channel/${targetUrl}/videos`;
    } else if (targetUrl.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${targetUrl}/videos`;
    } else {
      targetUrl = `https://www.youtube.com/@${targetUrl}/videos`;
    }
  } else if (!targetUrl.endsWith('/videos') && !targetUrl.includes('/watch')) {
    targetUrl = `${targetUrl}/videos`;
  }

  const endIndex = startIndex + count - 1;
  const args = [
    '--dump-single-json',
    '--playlist-items', `${startIndex}-${endIndex}`,
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    ...DEFAULT_LANG_ARGS,
  ];

  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(targetUrl);

  return new Promise((resolve) => {
    const proc = spawn(ytDlp, args);
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      try {
        const json = JSON.parse(output);
        const entries = json.entries || [];
        const channelTitle = json.channel || json.uploader || json.title || '';
        const channelId = json.channel_id || json.id || json.uploader_id || '';
        const avatarUrl = json.channel_avatar || json.avatar || '';

        const videos = entries.map((v: any) => ({
          id: v.id,
          channel_id: v.channel_id || channelId,
          channel_title: v.channel || v.uploader || channelTitle,
          channel_avatar: avatarUrl,
          title: v.title || 'Vidéo',
          duration: v.duration || 0,
          duration_string: v.duration ? formatDuration(v.duration) : (v.duration_string || ''),
          durationString: v.duration ? formatDuration(v.duration) : (v.duration_string || ''),
          upload_date: v.upload_date || '',
          uploadDate: v.upload_date || '',
          view_count: v.view_count || 0,
          viewCount: v.view_count || 0,
          thumbnail_url: v.thumbnail || (v.thumbnails?.length ? v.thumbnails[v.thumbnails.length - 1].url : `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`),
          thumbnailUrl: v.thumbnail || (v.thumbnails?.length ? v.thumbnails[v.thumbnails.length - 1].url : `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`),
          is_downloaded: 0,
          url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
        }));
        resolve(videos);
      } catch (_) {
        resolve([]);
      }
    });
  });
}

export async function getVideoDetails(videoUrlOrId: string): Promise<any> {
  const ytDlp = findYtDlpPath();
  const url = videoUrlOrId.startsWith('http') ? videoUrlOrId : `https://www.youtube.com/watch?v=${videoUrlOrId}`;

  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    '--extractor-args', 'youtube:player_client=android,web',
    '--no-check-certificates',
    '--js-runtimes', 'node',
    '--add-header', 'Accept-Language: fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  ];

  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, args);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !output) {
        return reject(new Error(errorOutput || 'Impossible de récupérer la vidéo'));
      }

      try {
        const json = JSON.parse(output);
        resolve({
          id: json.id,
          title: json.title,
          description: json.description,
          duration: json.duration,
          durationString: formatDuration(json.duration),
          channelTitle: json.channel || json.uploader,
          channelId: json.channel_id || json.uploader_id,
          channelAvatar: json.channel_avatar || '',
          viewCount: json.view_count,
          likeCount: json.like_count,
          uploadDate: json.upload_date,
          thumbnailUrl: json.thumbnail || `https://i.ytimg.com/vi/${json.id}/hqdefault.jpg`,
          categories: json.categories || [],
          tags: json.tags || [],
          chapters: json.chapters || [],
        });
      } catch (err: any) {
        reject(err);
      }
    });
  });
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  downloadedBytes: number;
  totalBytes: number;
  status: string;
}

export function downloadVideoWithProgress(
  taskId: string,
  url: string,
  options: {
    maxResolution?: string;
    onProgress: (prog: ProgressData) => void;
  }
): Promise<{ videoPath: string; thumbnailPath?: string; jsonPath?: string; metadata: any }> {
  return new Promise((resolve, reject) => {
    const ytDlp = findYtDlpPath();
    const resolution = options.maxResolution || '1080p';
    
    // Parse height for quality constraint
    let height = 1080;
    if (resolution.includes('2160') || resolution.toLowerCase().includes('4k')) height = 2160;
    else if (resolution.includes('1440')) height = 1440;
    else if (resolution.includes('720')) height = 720;
    else if (resolution.includes('480')) height = 480;

    const outputTemplate = path.join(
      DOWNLOADS_DIR,
      '%(channel,uploader,NA)s',
      '%(upload_date>%Y-%m-%d,NA)s - %(title)s [%(id)s].%(ext)s'
    );

    const args = [
      '--format', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`,
      '--merge-output-format', 'mp4',
      '--write-thumbnail',
      '--convert-thumbnails', 'webp',
      '--write-info-json',
      '--embed-metadata',
      '--embed-chapters',
      '--output', outputTemplate,
      '--newline',
      '--progress-template', '%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s',
      '--no-mtime',
      '--extractor-args', 'youtube:player_client=android,web',
      '--no-check-certificates',
      '--js-runtimes', 'node',
      '--add-header', 'Accept-Language: fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    ];

    if (fs.existsSync(COOKIES_FILE)) {
      args.push('--cookies', COOKIES_FILE);
    }

    args.push(url);

    const proc = spawn(ytDlp, args);
    let fullOutput = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      fullOutput += line;

      // Check for progress template pattern
      const parts = line.trim().split('|');
      if (parts.length >= 4) {
        const rawPercent = parts[0].replace('%', '').trim();
        const percent = parseFloat(rawPercent) || 0;
        const speed = parts[1]?.trim() || '';
        const eta = parts[2]?.trim() || '';
        const downloadedBytes = parseInt(parts[3]?.trim() || '0', 10);
        const totalBytes = parseInt(parts[4]?.trim() || '0', 10);

        options.onProgress({
          percent,
          speed,
          eta,
          downloadedBytes,
          totalBytes,
          status: percent >= 100 ? 'Traitement audio/vidéo...' : 'Téléchargement...',
        });
      }
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(errorOutput || `yt-dlp a échoué avec le code ${code}`));
      }

      // Find the created video file and metadata
      try {
        // Search in downloads directory for the most recently modified files
        const findRecentFiles = (dir: string): string[] => {
          let results: string[] = [];
          if (!fs.existsSync(dir)) return results;
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              results = results.concat(findRecentFiles(fullPath));
            } else {
              results.push(fullPath);
            }
          }
          return results;
        };

        const allFiles = findRecentFiles(DOWNLOADS_DIR);
        // Find .info.json files sorted by mtime descending
        const jsonFiles = allFiles
          .filter(f => f.endsWith('.info.json'))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

        if (jsonFiles.length === 0) {
          return resolve({
            videoPath: '',
            metadata: {},
          });
        }

        const latestJson = jsonFiles[0];
        const baseWithoutExt = latestJson.slice(0, -'.info.json'.length);
        const videoPath = fs.existsSync(`${baseWithoutExt}.mp4`) ? `${baseWithoutExt}.mp4` : `${baseWithoutExt}.mkv`;
        const thumbnailPath = fs.existsSync(`${baseWithoutExt}.webp`) ? `${baseWithoutExt}.webp` : `${baseWithoutExt}.jpg`;
        
        let metadata: any = {};
        try {
          metadata = JSON.parse(fs.readFileSync(latestJson, 'utf-8'));
        } catch (_) {}

        resolve({
          videoPath,
          thumbnailPath: fs.existsSync(thumbnailPath) ? thumbnailPath : undefined,
          jsonPath: latestJson,
          metadata,
        });
      } catch (err: any) {
        reject(err);
      }
    });
  });
}
