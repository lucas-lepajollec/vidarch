import { spawn, execFile, execFileSync, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { findYtDlpPath, DOWNLOADS_DIR, COOKIES_FILE, DATA_DIR } from '../config.js';
import {
  isAllowedYouTubeTarget,
  looksLikeUrl,
  normalizeYouTubeUrl,
  pickChannelImages,
  pickContentLanguage,
  pickVideoThumbnail,
  isYouTubeVideoId,
  extractYouTubeVideoId,
} from '../utils/youtube.js';
import { rememberFetchedChannel, rememberFetchedVideo } from '../utils/contentLocale.js';
import { fetchChannelVideoCount, hydrateOriginalVideos } from '../utils/innertube.js';
import {
  parseMaxHeight as parseMaxHeightCap,
  buildYtDlpFormatSelector,
  buildYtDlpFormatSort,
  isFatalDownloadError,
  youtubeDownloadAttempts,
  metadataPlayerClient,
  LAST_RESORT_FORMAT,
  qualityLabelFromHeight,
} from '../utils/ytdlpDownload.js';

const execFileAsync = promisify(execFile);

const activeDownloads = new Map<string, ChildProcess>();
const canceledDownloads = new Set<string>();

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

export function cancelDownload(taskId: string): boolean {
  canceledDownloads.add(taskId);
  const proc = activeDownloads.get(taskId);
  if (!proc || proc.killed) return false;
  try {
    proc.kill('SIGTERM');
  } catch (_) {}
  setTimeout(() => {
    try {
      if (!proc.killed) proc.kill('SIGKILL');
    } catch (_) {}
  }, 4000);
  return true;
}

function assertAllowedTarget(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Cible YouTube vide');
  if (looksLikeUrl(trimmed) && !isAllowedYouTubeTarget(trimmed)) {
    throw new Error('URL non autorisée. Seuls les liens YouTube sont acceptés.');
  }
  if (!isAllowedYouTubeTarget(trimmed)) {
    throw new Error('Cible YouTube invalide');
  }
  return looksLikeUrl(trimmed) ? normalizeYouTubeUrl(trimmed) : trimmed;
}

function cookieArgs(): string[] {
  return fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
}

function hasCookies(): boolean {
  return fs.existsSync(COOKIES_FILE);
}

function ffmpegLocationArgs(): string[] {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const out = execFileSync(cmd, [name], { encoding: 'utf-8', timeout: 4000, windowsHide: true }).trim();
    const first = out.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) return ['--ffmpeg-location', first];
  } catch (_) {}
  return [];
}

function spawnEnv(): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  return {
    ...process.env,
    PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ''}`,
  };
}

function jsRuntimeArgs(): string[] {
  return ['--js-runtimes', `node:${process.execPath}`];
}

function ytdlpCacheDir(): string {
  const dir = path.join(DATA_DIR, 'ytdlp-cache');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function playerClientArgs(client: string | null): string[] {
  if (!client) return jsRuntimeArgs();
  return [...jsRuntimeArgs(), '--extractor-args', `youtube:player_client=${client}`];
}

function metadataClientArgs(): string[] {
  const client = metadataPlayerClient(hasCookies());
  return [...(hasCookies() ? cookieArgs() : []), ...playerClientArgs(client)];
}

export function getYtDlpLangArgs(): string[] {
  return metadataClientArgs();
}

export function parseMaxHeight(resolution?: string): number {
  return parseMaxHeightCap(resolution);
}

export { buildYtDlpFormatSelector };

export function resolutionLabelFromMetadata(meta: any, fallback: string): string {
  const h = Number(meta?.height);
  if (Number.isFinite(h) && h > 0) return `${Math.round(h)}p`;
  if (typeof meta?.resolution === 'string' && meta.resolution.trim()) {
    return meta.resolution.trim();
  }
  return fallback;
}

export async function probeVideoHeight(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=height',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 15000, windowsHide: true });
    const h = parseInt(String(stdout).trim(), 10);
    return Number.isFinite(h) && h > 0 ? h : null;
  } catch {
    return null;
  }
}


function runYtDlp(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  const ytDlp = findYtDlpPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, args, { windowsHide: true, env: spawnEnv() });
    let stdout = '';
    let stderr = '';
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          try { proc.kill('SIGTERM'); } catch (_) {}
          reject(new Error('yt-dlp a dépassé le délai imparti'));
        }, timeoutMs)
      : null;

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export async function getYtDlpVersion(): Promise<string> {
  const ytDlp = findYtDlpPath();
  try {
    const { stdout } = await execFileAsync(ytDlp, ['--version'], { timeout: 15000, windowsHide: true });
    return stdout.trim();
  } catch (err: any) {
    console.error('Error getting yt-dlp version:', err.message);
    return 'Non disponible';
  }
}

export async function updateYtDlp(): Promise<{ success: boolean; message: string }> {
  const ytDlp = findYtDlpPath();
  try {
      const { stdout, stderr } = await execFileAsync(ytDlp, ['-U'], { timeout: 120000, windowsHide: true });
      try {
        await execFileAsync('py', ['-3', '-m', 'pip', 'install', '-U', 'yt-dlp[default]'], {
          timeout: 120000,
          windowsHide: true,
        });
      } catch (_) {
        try {
          await execFileAsync('python', ['-m', 'pip', 'install', '-U', 'yt-dlp[default]'], {
            timeout: 120000,
            windowsHide: true,
          });
        } catch (_) {}
      }
      return { success: true, message: (stdout || stderr || 'yt-dlp mis à jour').trim() };
  } catch (err: any) {
    try {
      const { stdout } = await execFileAsync('python', ['-m', 'pip', 'install', '-U', 'yt-dlp[default]'], {
        timeout: 120000,
        windowsHide: true,
      });
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
  channelAvatar?: string;
  language?: string;
}

function toChannelUrl(channelUrlOrHandle: string): string {
  const safe = assertAllowedTarget(channelUrlOrHandle);
  if (looksLikeUrl(safe)) {
    if (!safe.endsWith('/videos') && !safe.includes('/watch')) {
      return `${safe.replace(/\/+$/, '')}/videos`;
    }
    return safe;
  }
  if (safe.startsWith('UC') || safe.startsWith('HC')) {
    return `https://www.youtube.com/channel/${safe}/videos`;
  }
  if (safe.startsWith('@')) {
    return `https://www.youtube.com/${safe}/videos`;
  }
  return `https://www.youtube.com/@${safe}/videos`;
}

export async function searchYouTube(query: string, limit = 15): Promise<YouTubeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const isDirectUrl = looksLikeUrl(trimmed);
  if (isDirectUrl && !isAllowedYouTubeTarget(trimmed)) {
    return [];
  }
  if (!isAllowedYouTubeTarget(trimmed)) {
    return [];
  }

  const searchArg = isDirectUrl ? normalizeYouTubeUrl(trimmed) : `ytsearch${Math.min(Math.max(limit, 1), 50)}:${trimmed}`;

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    ...metadataClientArgs(),
    searchArg,
  ];

  try {
    const { stdout, stderr, code } = await runYtDlp(args, 90000);
    if (code !== 0 && !stdout) {
      console.error('yt-dlp search error:', stderr);
      return [];
    }
    const json = JSON.parse(stdout);
    const results: YouTubeSearchResult[] = [];
    const entries = json.entries || [json];

    for (const item of entries) {
      if (!item) continue;
      const isChannel = item._type === 'playlist' && (item.channel_id || item.uploader_id || item.url?.includes('/channel/') || item.url?.includes('/@'));
      const images = pickChannelImages(item);
      const thumbnailUrl = pickVideoThumbnail(item);

      results.push({
        id: item.id || item.url || '',
        type: isChannel ? 'channel' : 'video',
        title: item.title || item.channel || 'Sans titre',
        channelTitle: item.channel || item.uploader || item.uploader_id || '',
        channelId: item.channel_id || item.uploader_id || '',
        duration: item.duration || 0,
        durationString: item.duration ? formatDuration(item.duration) : '',
        thumbnailUrl,
        url: item.url || (item.id && isYouTubeVideoId(item.id) ? `https://www.youtube.com/watch?v=${item.id}` : ''),
        description: item.description || '',
        viewCount: item.view_count || 0,
        uploadDate: item.upload_date || '',
        avatarUrl: images.avatarUrl,
        channelAvatar: images.avatarUrl,
        language: pickContentLanguage(item),
      });
    }
    for (const item of results) {
      if (item.type === 'channel') rememberFetchedChannel(item);
    }
    await hydrateOriginalVideos(results.filter((item) => item.type !== 'channel'));
    return results;
  } catch (err: any) {
    console.error('Failed to parse yt-dlp JSON:', err.message);
    return [];
  }
}

export async function getChannelDetails(channelUrlOrHandle: string, maxItems = 50): Promise<any> {
  const targetUrl = toChannelUrl(channelUrlOrHandle);
  const cap = maxItems && maxItems > 0 ? Math.min(maxItems, 200) : 100;

  const args = [
    '--dump-single-json',
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    '--playlist-items', `1-${cap}`,
    ...metadataClientArgs(),
    targetUrl,
  ];

  const { stdout, stderr, code } = await runYtDlp(args, 180000);
  if (code !== 0 && !stdout) {
    throw new Error(stderr || 'Erreur lors de la récupération de la chaîne');
  }
  if (!stdout || !stdout.trim()) {
    throw new Error(stderr || 'Réponse vide de yt-dlp');
  }

  const json = JSON.parse(stdout.trim());
  if (!json || typeof json !== 'object') {
    throw new Error('Données de chaîne non reconnues');
  }

  const channelId = json.channel_id || json.id || json.uploader_id;
  const channelTitle = json.channel || json.uploader || json.title || 'Chaîne YouTube';
  const { avatarUrl, bannerUrl } = pickChannelImages(json);

  const videos = (json.entries || []).map((v: any) => ({
    id: v.id,
    title: v.title || 'Vidéo',
    duration: v.duration || 0,
    durationString: v.duration ? formatDuration(v.duration) : '',
    uploadDate: v.upload_date || '',
    viewCount: v.view_count || 0,
    thumbnailUrl: pickVideoThumbnail(v),
    url: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
    language: pickContentLanguage(v),
  }));

  const fetched = videos.length;
  const truncated = fetched >= cap;
  const reported = Number(json.playlist_count || 0);
  let videoCount = 0;
  if (reported > fetched || (reported > 0 && !truncated)) {
    videoCount = reported;
  } else if (!truncated && fetched > 0) {
    videoCount = fetched;
  }
  if (channelId && (videoCount <= 0 || (truncated && videoCount <= cap))) {
    const liveCount = await fetchChannelVideoCount(String(channelId));
    if (liveCount > videoCount) videoCount = liveCount;
  }

  const channel = {
    id: channelId,
    title: channelTitle,
    handle: json.uploader_id ? `@${String(json.uploader_id).replace(/^@/, '')}` : (json.channel_id ? `@${channelTitle.replace(/\s+/g, '')}` : ''),
    description: json.description || '',
    avatarUrl,
    bannerUrl,
    subscriberCount: json.channel_follower_count ? `${json.channel_follower_count} abonnés` : '',
    videoCount,
    videos,
    url: targetUrl,
    language: pickContentLanguage(json),
  };

  rememberFetchedChannel(channel);
  await hydrateOriginalVideos(videos);

  return channel;
}

export async function getChannelVideos(channelUrlOrHandle: string, startIndex = 1, count = 50): Promise<any[]> {
  const targetUrl = toChannelUrl(channelUrlOrHandle);
  const start = Math.max(1, startIndex);
  const cap = Math.min(Math.max(1, count), 100);
  const endIndex = start + cap - 1;

  const args = [
    '--dump-single-json',
    '--playlist-items', `${start}-${endIndex}`,
    '--flat-playlist',
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    ...metadataClientArgs(),
    targetUrl,
  ];

  try {
    const { stdout } = await runYtDlp(args, 180000);
    const json = JSON.parse(stdout);
    const entries = json.entries || [];
    const channelTitle = json.channel || json.uploader || json.title || '';
    const channelId = json.channel_id || json.id || json.uploader_id || '';
    const { avatarUrl } = pickChannelImages(json);

    const mapped = entries.map((v: any) => ({
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
      thumbnail_url: pickVideoThumbnail(v),
      thumbnailUrl: pickVideoThumbnail(v),
      is_downloaded: 0,
      url: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
      language: pickContentLanguage(v),
    }));
    await hydrateOriginalVideos(mapped);
    return mapped;
  } catch (_) {
    return [];
  }
}

export async function getVideoDetails(videoUrlOrId: string): Promise<any> {
  const idOrUrl = videoUrlOrId.trim();
  const url = looksLikeUrl(idOrUrl)
    ? (isAllowedYouTubeTarget(idOrUrl) ? normalizeYouTubeUrl(idOrUrl) : '')
    : (isYouTubeVideoId(idOrUrl) ? `https://www.youtube.com/watch?v=${idOrUrl}` : '');

  if (!url) throw new Error('Identifiant ou URL YouTube invalide');

  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    '--no-playlist',
    ...metadataClientArgs(),
    url,
  ];

  const { stdout, stderr, code } = await runYtDlp(args, 90000);
  if (code !== 0 && !stdout) {
    throw new Error(stderr || 'Impossible de récupérer la vidéo');
  }
  const json = JSON.parse(stdout);
  const images = pickChannelImages(json);
  const details = {
    id: json.id,
    title: json.title,
    description: json.description,
    duration: json.duration,
    durationString: formatDuration(json.duration),
    channelTitle: json.channel || json.uploader,
    channelId: json.channel_id || json.uploader_id,
    channelAvatar: images.avatarUrl,
    viewCount: json.view_count,
    likeCount: json.like_count,
    uploadDate: json.upload_date,
    thumbnailUrl: pickVideoThumbnail(json),
    categories: json.categories || [],
    tags: json.tags || [],
    chapters: json.chapters || [],
    language: pickContentLanguage(json),
  };
  rememberFetchedVideo(details);
  if (details.channelId) {
    rememberFetchedChannel({
      id: details.channelId,
      title: details.channelTitle,
      language: details.language,
    });
  }
  await hydrateOriginalVideos([details]);
  return details;
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  downloadedBytes: number;
  totalBytes: number;
  status: string;
}

function siblingWithExt(baseWithoutExt: string, exts: string[]): string | undefined {
  for (const ext of exts) {
    const p = `${baseWithoutExt}${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function removeDownloadArtifacts(videoPath: string) {
  try { if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch (_) {}
  try {
    const parsed = path.parse(videoPath);
    const base = path.join(parsed.dir, parsed.name);
    for (const ext of ['.webp', '.jpg', '.jpeg', '.png', '.info.json', '.part']) {
      try { fs.unlinkSync(base + ext); } catch (_) {}
    }
  } catch (_) {}
}

function removePartialFiles(videoId: string) {
  if (!isYouTubeVideoId(videoId)) return;
  const needle = `[${videoId}]`;
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (entry.name.includes(needle) && entry.name.endsWith('.part')) {
        try { fs.unlinkSync(full); } catch (_) {}
      }
    }
  };
  walk(DOWNLOADS_DIR, 0);
}

function lastUsefulError(message: string): string {
  const lines = message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hit = [...lines].reverse().find((line) => /ERROR|403|UNPLAYABLE|not available|nsig|Forbidden/i.test(line));
  return hit || lines[lines.length - 1] || message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renameStripClientTag(filePath: string | undefined, client: string): string | undefined {
  if (!filePath) return filePath;
  const tagged = `.${client}.`;
  if (!filePath.includes(tagged)) return filePath;
  const dest = filePath.replace(tagged, '.');
  if (dest === filePath) return filePath;
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    if (fs.existsSync(filePath)) fs.renameSync(filePath, dest);
  } catch (_) {
    return filePath;
  }
  return dest;
}

function spawnDownload(args: {
  taskId: string;
  ytDlp: string;
  cliArgs: string[];
  printFile: string;
  onProgress: (prog: ProgressData) => void;
}): Promise<{ videoPath: string; thumbnailPath?: string; jsonPath?: string; metadata: any }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(args.ytDlp, args.cliArgs, { windowsHide: true, env: spawnEnv() });
    activeDownloads.set(args.taskId, proc);
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      const parts = line.trim().split('|');
      if (parts.length >= 4) {
        const rawPercent = parts[0].replace('%', '').trim();
        const percent = parseFloat(rawPercent) || 0;
        args.onProgress({
          percent,
          speed: parts[1]?.trim() || '',
          eta: parts[2]?.trim() || '',
          downloadedBytes: parseInt(parts[3]?.trim() || '0', 10),
          totalBytes: parseInt(parts[4]?.trim() || '0', 10),
          status: percent >= 100 ? 'Traitement audio/vidéo...' : 'Téléchargement...',
        });
      }
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('error', (err) => {
      activeDownloads.delete(args.taskId);
      reject(err);
    });

    proc.on('close', (code) => {
      activeDownloads.delete(args.taskId);

      if (code !== 0) {
        try { if (fs.existsSync(args.printFile)) fs.unlinkSync(args.printFile); } catch (_) {}
        return reject(new Error(errorOutput || `yt-dlp a échoué avec le code ${code}`));
      }

      try {
        let videoPath = '';
        if (fs.existsSync(args.printFile)) {
          const printed = fs.readFileSync(args.printFile, 'utf-8').trim().split(/\r?\n/).filter(Boolean);
          videoPath = printed[printed.length - 1] || '';
          try { fs.unlinkSync(args.printFile); } catch (_) {}
        }

        if (!videoPath || !fs.existsSync(videoPath)) {
          return reject(new Error('Fichier vidéo introuvable après téléchargement'));
        }

        const parsed = path.parse(videoPath);
        const baseWithoutExt = path.join(parsed.dir, parsed.name);
        const thumbnailPath = siblingWithExt(baseWithoutExt, ['.webp', '.jpg', '.jpeg', '.png']);
        const jsonPath = siblingWithExt(baseWithoutExt, ['.info.json']);

        let metadata: any = {};
        if (jsonPath) {
          try {
            metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          } catch (_) {}
        }

        resolve({ videoPath, thumbnailPath, jsonPath, metadata });
      } catch (err: any) {
        reject(err);
      }
    });
  });
}

export type DownloadOutcome = {
  videoPath: string;
  thumbnailPath?: string;
  jsonPath?: string;
  metadata: any;
  requestedHeight: number;
  actualHeight: number;
  actualLabel: string;
};

export async function downloadVideoWithProgress(
  taskId: string,
  url: string,
  options: {
    maxResolution?: string;
    onProgress: (prog: ProgressData) => void;
  }
): Promise<DownloadOutcome> {
  canceledDownloads.delete(taskId);
  let target: string;
  try {
    target = looksLikeUrl(url)
      ? (isAllowedYouTubeTarget(url) ? normalizeYouTubeUrl(url) : '')
      : (isYouTubeVideoId(url) ? `https://www.youtube.com/watch?v=${url}` : '');
    if (!target) throw new Error('URL YouTube invalide');
  } catch (err: any) {
    throw err;
  }

  const ytDlp = findYtDlpPath();
  const height = parseMaxHeight(options.maxResolution);
  const printFile = path.join(os.tmpdir(), `vidarch-out-${taskId}.txt`);
  const attempts = youtubeDownloadAttempts(hasCookies());
  const videoId = extractYouTubeVideoId(target) || '';
  const cacheDir = ytdlpCacheDir();
  const outputTemplate = path.join(
    DOWNLOADS_DIR,
    '%(channel,uploader,NA)s',
    '%(upload_date>%Y-%m-%d,NA)s - %(title)s [%(id)s].%(ext)s'
  );
  const passes: Array<{ name: string; format: string; sort?: string }> = [
    { name: 'sorted', format: buildYtDlpFormatSelector(height), sort: buildYtDlpFormatSort(height) },
    { name: 'any', format: LAST_RESORT_FORMAT },
  ];

  type DownloadResult = { videoPath: string; thumbnailPath?: string; jsonPath?: string; metadata: any };
  let lastError: Error | null = null;

  const toOutcome = (result: DownloadResult, client: string, actualHeight: number): DownloadOutcome => {
    const finalized = {
      videoPath: renameStripClientTag(result.videoPath, client) || result.videoPath,
      thumbnailPath: renameStripClientTag(result.thumbnailPath, client),
      jsonPath: renameStripClientTag(result.jsonPath, client),
      metadata: result.metadata,
    };
    return {
      ...finalized,
      requestedHeight: height,
      actualHeight,
      actualLabel: actualHeight > 0 ? qualityLabelFromHeight(actualHeight) : qualityLabelFromHeight(height),
    };
  };

  let attemptIndex = 0;
  removePartialFiles(videoId);
  for (const pass of passes) {
    for (const attempt of attempts) {
      if (canceledDownloads.has(taskId)) throw new Error('canceled');
      if (attemptIndex > 0) await sleep(800);
      attemptIndex += 1;
      try { if (fs.existsSync(printFile)) fs.unlinkSync(printFile); } catch (_) {}
      const clientTag = attempt.client || 'default';
      try {
        console.log(`[yt-dlp] ${pass.name} client=${clientTag} cookies=${attempt.useCookies} sort=${pass.sort || 'none'}`);
        const result = await spawnDownload({
          taskId,
          ytDlp,
          cliArgs: [
            '--ignore-config',
            '--format', pass.format,
            ...(pass.sort ? ['--format-sort', pass.sort] : []),
            '--merge-output-format', 'mp4',
            '--write-thumbnail',
            '--write-info-json',
            '--embed-metadata',
            '--embed-chapters',
            '--no-playlist',
            '--continue',
            '--force-ipv4',
            '--http-chunk-size', '1M',
            '--cache-dir', cacheDir,
            '--remote-components', 'ejs:github',
            '--retries', '10',
            '--fragment-retries', '10',
            '--retry-sleep', '2',
            '--concurrent-fragments', '1',
            '--newline',
            '--progress-template', '%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s',
            '--no-mtime',
            '--print-to-file', 'after_move:%(filepath)s', printFile,
            ...ffmpegLocationArgs(),
            '--output', outputTemplate,
            ...(attempt.useCookies ? cookieArgs() : []),
            ...playerClientArgs(attempt.client),
            target,
          ],
          printFile,
          onProgress: options.onProgress,
        });

        if (canceledDownloads.has(taskId)) {
          removeDownloadArtifacts(result.videoPath);
          throw new Error('canceled');
        }

        const probed = result.videoPath ? await probeVideoHeight(result.videoPath) : null;
        const metaHeight = Number(result.metadata?.height);
        const actualHeight = probed || (Number.isFinite(metaHeight) && metaHeight > 0 ? metaHeight : 0);
        console.log(`[yt-dlp] ${clientTag} got ${actualHeight || '?'}p`);
        return toOutcome(result, clientTag, actualHeight > 0 ? actualHeight : height);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[yt-dlp] ${pass.name} ${clientTag} failed: ${lastUsefulError(lastError.message)}`);
        if (canceledDownloads.has(taskId) || isFatalDownloadError(lastError.message)) throw lastError;
        removePartialFiles(videoId);
      }
    }
  }

  throw lastError || new Error('Téléchargement YouTube impossible');
}
