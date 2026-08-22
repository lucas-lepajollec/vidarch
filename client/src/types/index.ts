export interface Video {
  id: string;
  channel_id: string;
  channel_title: string;
  title: string;
  description?: string;
  duration?: number;
  duration_string?: string;
  view_count?: number;
  upload_date?: string;
  thumbnail_url?: string;
  local_thumbnail_path?: string;
  local_video_path?: string;
  local_json_path?: string;
  file_size?: number;
  resolution?: string;
  fps?: number;
  ext?: string;
  is_downloaded: number; // 0 or 1
  watch_progress: number; // in seconds
  is_watched: number; // 0 or 1
  liked: number; // 0 or 1
  created_at: string;
  downloaded_at?: string;
  channel_avatar?: string;
  last_watched_at?: string;
  chapters?: Array<{ title: string; start_time: number; end_time: number }>;
  language?: string;
  channel_video_count?: number;
  channel_downloaded_count?: number;
}

export interface Channel {
  id: string;
  title: string;
  handle?: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  subscriber_count?: string;
  video_count?: number;
  custom_url?: string;
  auto_download?: number;
  auto_download_mode?: 'future' | 'all' | string | null;
  auto_download_channel_id?: string | null;
  max_resolution?: string;
  last_scanned_at?: string;
  downloaded_count?: number;
  total_detected_videos?: number;
  is_subscribed?: number;
  is_owner?: number;
  is_active_owner?: number;
  linked_youtube_id?: string | null;
  language?: string;
}

export interface DownloadTask {
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

export interface SearchResultItem {
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
  channelAvatar?: string;
  avatarUrl?: string;
  language?: string;
}

export interface SystemStatus {
  ytdlpVersion: string;
  ytdlpPath: string;
  hasCookies: boolean;
  downloadedCount: number;
  channelsCount: number;
  totalDetected: number;
  storageSizeBytes: number;
  storageFormatted: string;
  downloadsDir: string;
  isScanning: boolean;
}

export type PageRoute = 'home' | 'subscriptions' | 'library' | 'history' | 'liked' | 'playlists' | 'downloads' | 'settings' | 'watch' | 'channel' | 'search' | 'mychannel';

export interface NavigationState {
  page: PageRoute;
  videoId?: string;
  channelId?: string;
  query?: string;
  playlistId?: string;
  playlistShuffle?: boolean;
}

export interface PlaylistSummary {
  id: string;
  title: string;
  system: boolean;
  video_count: number;
  cover_thumb?: string;
  cover_video_id?: string;
  local_thumbnail_path?: string;
  is_downloaded?: number;
  contains?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AuthStatus {
  loading: boolean;
  required: boolean;
  authenticated: boolean;
  setupAvailable: boolean;
  envLocked: boolean;
}
