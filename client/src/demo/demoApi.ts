import type { Channel, DownloadTask, PlaylistSummary, Video } from '../types';
import {
  demoChannels,
  demoInitialQueue,
  demoPlaylists,
  demoPlaylistVideos,
  demoSearchItems,
  demoVideos,
} from './fixtures';
import { DEMO_VIDEO_PATH, isDemoMode } from './config';

type DemoSearch = {
  id: string;
  query: string;
  searched_at: string;
};

type DemoState = {
  channels: Channel[];
  videos: Video[];
  playlists: PlaylistSummary[];
  playlistVideos: Record<string, string[]>;
  queue: DownloadTask[];
  searches: DemoSearch[];
  settings: Record<string, string>;
};

const initialSearches: DemoSearch[] = [
  { id: 'demo-search-1', query: 'design', searched_at: '2026-08-24T12:30:00.000Z' },
  { id: 'demo-search-2', query: 'espace', searched_at: '2026-08-23T18:10:00.000Z' },
  { id: 'demo-search-3', query: 'documentaire', searched_at: '2026-08-22T09:15:00.000Z' },
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function freshState(): DemoState {
  return {
    channels: clone(demoChannels),
    videos: clone(demoVideos),
    playlists: clone(demoPlaylists),
    playlistVideos: clone(demoPlaylistVideos),
    queue: clone(demoInitialQueue),
    searches: clone(initialSearches),
    settings: {
      local_only: 'false',
      scan_enabled: 'true',
      ui_language: 'fr',
      default_max_resolution: '1080p',
      auto_update_ytdlp: 'true',
      preferred_video_codec: 'best',
      preferred_audio_codec: 'best',
    },
  };
}

let state = freshState();
let installed = false;
let nativeFetch: typeof window.fetch | null = null;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function readBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function notify(message: string): void {
  window.dispatchEvent(new CustomEvent('vidarch-demo-notice', { detail: message }));
}

function updateQueueProgress(): void {
  const now = Date.now();
  for (const task of state.queue) {
    if (!['queued', 'downloading', 'processing'].includes(task.status)) continue;
    const started = task.started_at ? Date.parse(task.started_at) : now;
    const elapsed = Math.max(0, now - started);
    const progress = Math.min(100, Math.round(elapsed / 75));
    task.progress = progress;
    task.status = progress >= 92 ? 'processing' : progress > 4 ? 'downloading' : 'queued';
    task.speed = progress > 4 && progress < 92 ? '18.4 Mo/s' : '';
    task.eta = progress > 4 && progress < 92 ? `${Math.max(1, Math.ceil((100 - progress) / 13))} s` : '';
    task.downloaded_bytes = Math.round(task.total_bytes * (progress / 100));

    if (progress >= 100) {
      task.status = 'completed';
      task.completed_at = new Date(now).toISOString();
      const video = state.videos.find((item) => item.id === task.video_id);
      if (video) {
        video.is_downloaded = 1;
        video.local_video_path = DEMO_VIDEO_PATH;
        video.file_size = task.total_bytes;
        video.resolution = task.resolution || '1080p';
        video.ext = 'mp4';
        video.downloaded_at = task.completed_at;
      }
    }
  }
}

function currentPlaylistSummary(playlist: PlaylistSummary): PlaylistSummary {
  const ids = state.playlistVideos[playlist.id] || [];
  const cover = state.videos.find((video) => video.id === ids[0]);
  return {
    ...playlist,
    video_count: ids.length,
    cover_thumb: cover?.thumbnail_url,
    cover_video_id: cover?.id,
    local_thumbnail_path: cover?.local_thumbnail_path,
    is_downloaded: cover?.is_downloaded,
  };
}

function routeVideos(url: URL, method: string, body: Record<string, unknown>): Response | null {
  if (url.pathname === '/api/videos/home-feed' && method === 'GET') {
    const downloaded = state.videos.filter((video) => video.is_downloaded === 1);
    const subscriptionsUndownloaded = state.videos.filter((video) => video.is_downloaded !== 1).slice(0, 12);
    const recentSearches = state.videos.filter((video) => video.is_downloaded !== 1).slice(4, 16);
    return json({
      downloaded,
      subscriptionsUndownloaded,
      recentSearches,
      totals: {
        downloaded: downloaded.length,
        subscriptionsUndownloaded: subscriptionsUndownloaded.length,
        recentSearches: recentSearches.length,
      },
    });
  }

  if (url.pathname === '/api/videos/disk-folders' && method === 'GET') {
    const downloaded = state.videos.filter((video) => video.is_downloaded === 1);
    const folders = state.channels.map((channel) => {
      const videos = downloaded.filter((video) => video.channel_id === channel.id);
      const folderSize = videos.reduce((sum, video) => sum + (video.file_size || 0), 0);
      return {
        folderName: channel.title,
        folderPath: `/demo/${channel.handle?.replace('@', '') || channel.id}`,
        folderSize,
        fileCount: videos.length * 3,
        videoCount: videos.length,
        channelAvatar: channel.avatar_url || '',
        videos,
        files: videos.flatMap((video) => [
          { name: `${video.id}.mp4`, size: video.file_size || 0, mtime: video.downloaded_at || video.created_at, type: 'video' },
          { name: `${video.id}.webp`, size: 340_000, mtime: video.downloaded_at || video.created_at, type: 'thumbnail' },
          { name: `${video.id}.json`, size: 12_000, mtime: video.downloaded_at || video.created_at, type: 'metadata' },
        ]),
      };
    }).filter((folder) => folder.videoCount > 0);
    return json({
      rootPath: '/demo/archives',
      totalDiskSize: folders.reduce((sum, folder) => sum + folder.folderSize, 0),
      folderCount: folders.length,
      videoCount: downloaded.length,
      folders,
    });
  }

  if (url.pathname === '/api/videos' && method === 'GET') {
    const tab = url.searchParams.get('tab') || 'all';
    if (tab === 'downloaded') return json(state.videos.filter((video) => video.is_downloaded === 1));
    if (tab === 'unwatched') return json(state.videos.filter((video) => video.is_watched !== 1));
    if (tab === 'recent') return json(state.videos.slice(6));
    if (tab === 'subscriptions' || tab === 'subscription-discoveries') return json(state.videos.filter((video) => video.is_downloaded !== 1));
    return json(state.videos);
  }

  const match = url.pathname.match(/^\/api\/videos\/([^/]+)(?:\/(progress|like|stream))?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  const action = match[2];
  const video = state.videos.find((item) => item.id === id);
  if (!video) return json({ error: 'Vidéo de démonstration introuvable' }, 404);

  if (!action && method === 'GET') {
    const related = state.videos.filter((item) => item.id !== id).sort((a, b) => Number(b.channel_id === video.channel_id) - Number(a.channel_id === video.channel_id)).slice(0, 10);
    return json({ video, related });
  }
  if (action === 'progress' && method === 'POST') {
    video.watch_progress = Number(body.progress || video.watch_progress || 0);
    video.last_watched_at = new Date().toISOString();
    return json({ success: true });
  }
  if (action === 'like' && method === 'POST') {
    video.liked = body.liked ? 1 : 0;
    const liked = state.playlistVideos.liked || (state.playlistVideos.liked = []);
    state.playlistVideos.liked = video.liked ? Array.from(new Set([video.id, ...liked])) : liked.filter((item) => item !== video.id);
    return json({ success: true });
  }
  if (!action && method === 'DELETE') {
    video.is_downloaded = 0;
    video.local_video_path = undefined;
    video.file_size = undefined;
    video.resolution = undefined;
    video.ext = undefined;
    notify('Archive retirée de la bibliothèque de démonstration.');
    return json({ success: true });
  }
  return null;
}

function routeChannels(url: URL, method: string, body: Record<string, unknown>): Response | null {
  const owner = state.channels.find((channel) => channel.is_active_owner === 1) || state.channels[0];
  if (url.pathname === '/api/channels/my-channel' && method === 'GET') return json(owner);
  if (url.pathname === '/api/channels/my-channels' && method === 'GET') return json(state.channels.filter((channel) => channel.is_owner === 1));
  if (url.pathname === '/api/channels' && method === 'GET') return json(state.channels.filter((channel) => channel.is_subscribed === 1 || channel.is_owner === 1));

  if (url.pathname === '/api/channels/subscribe' && method === 'POST') {
    const source = String(body.url || '');
    const id = state.channels.find((channel) => source.includes(channel.id) || (channel.handle && source.includes(channel.handle.replace('@', ''))))?.id;
    const channel = state.channels.find((item) => item.id === id) || state.channels[1];
    channel.is_subscribed = 1;
    return json({ success: true, channel });
  }

  const match = url.pathname.match(/^\/api\/channels\/([^/]+)(?:\/(more-videos|settings|unsubscribe|customize|set-active-owner|unclaim))?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  const action = match[2];
  const channel = state.channels.find((item) => item.id === id || item.handle === id || item.handle === `@${id.replace(/^@/, '')}`);
  if (!channel) return json({ error: 'Chaîne de démonstration introuvable' }, 404);

  if (action === 'more-videos' && method === 'GET') return json({ videos: [], hasMore: false });
  if (action === 'settings' && method === 'PUT') {
    channel.auto_download = body.autoDownload ? 1 : 0;
    channel.auto_download_mode = String(body.autoDownloadMode || 'future');
    channel.max_resolution = String(body.maxResolution || channel.max_resolution || '1080p');
    return json({ success: true, channel });
  }
  if (action === 'unsubscribe' && method === 'POST') {
    channel.is_subscribed = 0;
    return json({ success: true });
  }
  if (action === 'customize' && method === 'PUT') {
    if (typeof body.title === 'string') channel.title = body.title;
    if (typeof body.handle === 'string') channel.handle = body.handle;
    if (typeof body.description === 'string') channel.description = body.description;
    if (typeof body.avatarUrl === 'string') channel.avatar_url = body.avatarUrl || channel.avatar_url;
    if (typeof body.bannerUrl === 'string') channel.banner_url = body.bannerUrl || channel.banner_url;
    return json({ success: true, channel });
  }
  if (action === 'set-active-owner' && method === 'POST') {
    state.channels.forEach((item) => { item.is_active_owner = item.id === channel.id ? 1 : 0; });
    return json({ success: true, channel });
  }
  if (!action && method === 'DELETE') {
    channel.is_subscribed = 0;
    return json({ success: true });
  }
  if (!action && method === 'GET') {
    const videos = state.videos.filter((video) => video.channel_id === channel.id);
    return json({
      channel,
      downloadedVideos: videos.filter((video) => video.is_downloaded === 1),
      detectedVideos: videos.filter((video) => video.is_downloaded !== 1),
    });
  }
  return null;
}

function routePlaylists(url: URL, method: string, body: Record<string, unknown>): Response | null {
  if (url.pathname === '/api/playlists' && method === 'GET') {
    const contains = url.searchParams.get('contains');
    return json(state.playlists.map((playlist) => ({
      ...currentPlaylistSummary(playlist),
      contains: contains ? (state.playlistVideos[playlist.id] || []).includes(contains) : undefined,
    })));
  }
  if (url.pathname === '/api/playlists' && method === 'POST') {
    const id = `demo-playlist-${Date.now()}`;
    const playlist: PlaylistSummary = {
      id,
      title: String(body.title || 'Nouvelle playlist'),
      system: false,
      video_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.playlists.push(playlist);
    state.playlistVideos[id] = [];
    return json(playlist, 201);
  }

  const match = url.pathname.match(/^\/api\/playlists\/([^/]+)(?:\/videos(?:\/([^/]+))?)?$/);
  if (!match) return null;
  const playlistId = decodeURIComponent(match[1]);
  const videoId = match[2] ? decodeURIComponent(match[2]) : undefined;
  const playlist = state.playlists.find((item) => item.id === playlistId);
  if (!playlist) return json({ error: 'Playlist introuvable' }, 404);
  const ids = state.playlistVideos[playlist.id] || (state.playlistVideos[playlist.id] = []);

  if (match[0].includes('/videos')) {
    const targetId = videoId || String(body.videoId || '');
    if (method === 'POST' && targetId) state.playlistVideos[playlist.id] = Array.from(new Set([...ids, targetId]));
    if (method === 'DELETE' && targetId) state.playlistVideos[playlist.id] = ids.filter((id) => id !== targetId);
    return json({ ok: true, contains: method === 'POST' });
  }
  if (method === 'GET') return json({ playlist: currentPlaylistSummary(playlist), videos: ids.map((id) => state.videos.find((video) => video.id === id)).filter(Boolean) });
  if (method === 'PATCH') {
    playlist.title = String(body.title || playlist.title);
    return json({ ok: true, title: playlist.title });
  }
  if (method === 'DELETE') {
    state.playlists = state.playlists.filter((item) => item.id !== playlist.id);
    delete state.playlistVideos[playlist.id];
    return json({ ok: true });
  }
  return null;
}

function routeDownloads(url: URL, method: string, body: Record<string, unknown>): Response | null {
  updateQueueProgress();
  if (url.pathname === '/api/downloads/queue' && method === 'GET') return json(state.queue);
  if (url.pathname === '/api/downloads' && method === 'POST') {
    const videoId = String(body.videoId || '');
    const video = state.videos.find((item) => item.id === videoId);
    if (!video) return json({ error: 'Vidéo de démonstration introuvable' }, 404);
    const item: DownloadTask = {
      id: `demo-download-${Date.now()}`,
      video_id: video.id,
      url: String(body.url || `https://demo.invalid/${video.id}`),
      channel_id: video.channel_id,
      channel_title: video.channel_title,
      title: video.title,
      thumbnail_url: video.thumbnail_url || '',
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      downloaded_bytes: 0,
      total_bytes: 126_000_000,
      resolution: String(body.resolution || '1080p'),
      requested_resolution: String(body.resolution || '1080p'),
      format: 'mp4',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    };
    state.queue = [item, ...state.queue.filter((task) => task.video_id !== video.id)];
    notify('Téléchargement simulé ajouté à la file.');
    return json({ success: true, item });
  }
  if (url.pathname === '/api/downloads/cancel-all' && method === 'POST') {
    state.queue.forEach((task) => { if (['queued', 'downloading', 'processing'].includes(task.status)) task.status = 'canceled'; });
    return json({ success: true, canceled: true });
  }
  if (url.pathname === '/api/downloads/clear' && method === 'POST') {
    state.queue = state.queue.filter((task) => ['queued', 'downloading', 'processing'].includes(task.status));
    return json({ success: true });
  }
  const taskMatch = url.pathname.match(/^\/api\/downloads\/([^/]+)(?:\/(cancel|retry))?$/);
  if (!taskMatch) return null;
  const task = state.queue.find((item) => item.id === decodeURIComponent(taskMatch[1]));
  if (!task) return json({ success: true });
  if (taskMatch[2] === 'cancel' && method === 'POST') task.status = 'canceled';
  if (taskMatch[2] === 'retry' && method === 'POST') {
    task.status = 'queued';
    task.progress = 0;
    task.started_at = new Date().toISOString();
  }
  if (!taskMatch[2] && method === 'DELETE') state.queue = state.queue.filter((item) => item.id !== task.id);
  return json({ success: true });
}

async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const requestUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  const url = new URL(requestUrl, window.location.origin);
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const body = readBody(init);

  if (url.origin !== window.location.origin) {
    notify('Les connexions externes sont désactivées dans la démo publique.');
    return json({ error: 'Connexion externe désactivée en mode démo' }, 451);
  }
  if (!url.pathname.startsWith('/api/')) return nativeFetch!(input, init);

  const routed = routeVideos(url, method, body)
    || routeChannels(url, method, body)
    || routePlaylists(url, method, body)
    || routeDownloads(url, method, body);
  if (routed) return routed;

  if (url.pathname === '/api/search' && method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 20);
    const matches = (value: string | undefined) => !query || String(value || '').toLowerCase().includes(query);
    const channels = state.channels.filter((channel) => matches(channel.title) || matches(channel.description) || matches(channel.handle)).map((channel) => ({
      id: channel.id,
      title: channel.title,
      handle: channel.handle,
      avatarUrl: channel.avatar_url,
      bannerUrl: channel.banner_url,
      subscriberCount: channel.subscriber_count,
      description: channel.description,
      downloadedCount: channel.downloaded_count,
      isSubscribed: channel.is_subscribed === 1,
      url: `https://demo.invalid/channel/${channel.id}`,
      language: channel.language,
    }));
    const localVideos = state.videos.filter((video) => video.is_downloaded === 1 && (matches(video.title) || matches(video.channel_title)));
    const online = demoSearchItems.filter((item) => matches(item.title) || matches(item.channelTitle));
    const youtubeVideos = online.slice(offset, offset + limit);
    state.searches = [{ id: `demo-search-${Date.now()}`, query: query || 'vidarch', searched_at: new Date().toISOString() }, ...state.searches.filter((item) => item.query !== query)].slice(0, 8);
    return json({ channels, localVideos, youtubeVideos, count: youtubeVideos.length, hasMore: offset + limit < online.length });
  }

  if (url.pathname === '/api/history/videos' && method === 'GET') return json(state.videos.filter((video) => video.last_watched_at || video.watch_progress > 0).slice(0, 8));
  if (url.pathname === '/api/history/videos' && method === 'DELETE') {
    state.videos.forEach((video) => { video.watch_progress = 0; video.last_watched_at = undefined; });
    return json({ success: true });
  }
  const historyVideo = url.pathname.match(/^\/api\/history\/videos\/([^/]+)$/);
  if (historyVideo && method === 'DELETE') {
    const video = state.videos.find((item) => item.id === decodeURIComponent(historyVideo[1]));
    if (video) { video.watch_progress = 0; video.last_watched_at = undefined; }
    return json({ success: true });
  }
  if (url.pathname === '/api/history/searches' && method === 'GET') return json(state.searches);
  if (url.pathname === '/api/history/searches' && method === 'DELETE') { state.searches = []; return json({ success: true }); }
  const historySearch = url.pathname.match(/^\/api\/history\/searches\/([^/]+)$/);
  if (historySearch && method === 'DELETE') { state.searches = state.searches.filter((item) => item.id !== decodeURIComponent(historySearch[1])); return json({ success: true }); }

  if (url.pathname === '/api/system/settings' && method === 'GET') return json(state.settings);
  if (url.pathname === '/api/system/settings' && method === 'PUT') {
    Object.entries(body).forEach(([key, value]) => { state.settings[key] = String(value); });
    return json({ success: true });
  }
  if (url.pathname === '/api/system/status' && method === 'GET') {
    const downloaded = state.videos.filter((video) => video.is_downloaded === 1);
    const storageSizeBytes = downloaded.reduce((sum, video) => sum + (video.file_size || 0), 0);
    return json({
      ytdlpVersion: 'démo — désactivé',
      ytdlpPath: 'Aucun binaire utilisé',
      hasCookies: false,
      downloadedCount: downloaded.length,
      channelsCount: state.channels.length,
      totalDetected: state.videos.length,
      storageSizeBytes,
      storageFormatted: `${(storageSizeBytes / 1_000_000_000).toFixed(1)} Go`,
      downloadsDir: '/demo/archives',
      isScanning: false,
    });
  }
  if (url.pathname.startsWith('/api/system/') && method === 'POST') {
    notify('Cette action est simulée : aucun système réel n’est contacté.');
    return json({ success: true, message: 'Action simulée en mode démo' });
  }
  if (url.pathname === '/api/system/cookies' && method === 'DELETE') return json({ success: true });

  if (url.pathname === '/api/auth/status' && method === 'GET') return json({ required: false, authenticated: true, setupAvailable: false, envLocked: true });
  if (url.pathname.startsWith('/api/auth/') && method === 'POST') return json({ success: true });

  if (url.pathname === '/api/import/inspect-url' && method === 'POST') {
    const video = state.videos.find((item) => item.is_downloaded !== 1) || state.videos[0];
    return json({
      type: 'video',
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        url: `https://demo.invalid/watch/${video.id}`,
        channelTitle: video.channel_title,
        channelId: video.channel_id,
        thumbnailUrl: video.thumbnail_url,
        durationString: video.duration_string,
      },
    });
  }

  if (url.pathname.startsWith('/api/channels/') && method === 'POST') return json({ success: true, channel: state.channels[0] });

  console.warn(`[VidArch demo] Route non simulée: ${method} ${url.pathname}`);
  return json({ error: 'Cette action n’est pas disponible dans la démo publique.' }, 404);
}

export function installDemoApi(): void {
  if (!isDemoMode || installed) return;
  installed = true;
  state = freshState();
  nativeFetch = window.fetch.bind(window);
  window.fetch = demoFetch;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.href;
    if (href && new URL(href, window.location.origin).origin !== window.location.origin) {
      event.preventDefault();
      event.stopPropagation();
      notify('Les liens externes sont neutralisés dans la démo publique.');
    }
  }, true);
}
