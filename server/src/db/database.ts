import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DB_PATH, DOWNLOADS_DIR } from '../config.js';

export const db = new Database(DB_PATH);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // 1. Channels table
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      handle TEXT,
      description TEXT,
      avatar_url TEXT,
      banner_url TEXT,
      subscriber_count TEXT,
      video_count INTEGER DEFAULT 0,
      custom_url TEXT,
      is_owner INTEGER DEFAULT 0,
      language TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration for is_owner in channels table
  try {
    db.exec(`ALTER TABLE channels ADD COLUMN is_owner INTEGER DEFAULT 0;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE channels ADD COLUMN linked_youtube_id TEXT;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE channels ADD COLUMN owner_branding_backup TEXT;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE channels ADD COLUMN is_active_owner INTEGER DEFAULT 0;`);
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE channels ADD COLUMN origin_branding TEXT;`);
  } catch (_) {}

  try {
    db.exec(`
      UPDATE channels SET is_active_owner = 1
      WHERE is_owner = 1 AND id = (
        SELECT id FROM channels WHERE is_owner = 1 ORDER BY updated_at DESC LIMIT 1
      )
    `);
  } catch (_) {}

  // 2. Subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      channel_id TEXT PRIMARY KEY,
      auto_download INTEGER DEFAULT 0,
      max_resolution TEXT DEFAULT '1080p',
      download_shorts INTEGER DEFAULT 0,
      last_scanned_at TEXT,
      scan_interval_minutes INTEGER DEFAULT 60,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    );
  `);

  // 3. Videos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      channel_title TEXT,
      title TEXT NOT NULL,
      description TEXT,
      duration INTEGER DEFAULT 0,
      duration_string TEXT,
      view_count INTEGER DEFAULT 0,
      upload_date TEXT,
      thumbnail_url TEXT,
      local_thumbnail_path TEXT,
      local_video_path TEXT,
      local_json_path TEXT,
      local_subtitle_path TEXT,
      file_size INTEGER DEFAULT 0,
      resolution TEXT,
      fps INTEGER,
      ext TEXT,
      is_downloaded INTEGER DEFAULT 0,
      watch_progress REAL DEFAULT 0,
      is_watched INTEGER DEFAULT 0,
      liked INTEGER DEFAULT 0,
      last_watched_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      downloaded_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      language TEXT,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
    );
  `);

  try {
    db.exec(`ALTER TABLE videos ADD COLUMN last_watched_at TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN updated_at TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE subscriptions ADD COLUMN auto_download_mode TEXT DEFAULT 'future';`);
  } catch (_) {}

  // 4. Download Queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_queue (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      url TEXT NOT NULL,
      channel_id TEXT,
      channel_title TEXT,
      title TEXT NOT NULL,
      thumbnail_url TEXT,
      status TEXT DEFAULT 'queued',
      progress REAL DEFAULT 0,
      speed TEXT DEFAULT '',
      eta TEXT DEFAULT '',
      downloaded_bytes INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      error_message TEXT,
      resolution TEXT DEFAULT '1080p',
      format TEXT DEFAULT 'mp4',
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );
  `);

  try { db.exec(`ALTER TABLE download_queue ADD COLUMN requested_resolution TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE download_queue ADD COLUMN quality_note TEXT;`); } catch (_) {}

  // 5. Recent Search Videos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recent_search_videos (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel_title TEXT,
      channel_id TEXT,
      duration INTEGER DEFAULT 0,
      duration_string TEXT,
      thumbnail_url TEXT,
      view_count INTEGER DEFAULT 0,
      upload_date TEXT,
      url TEXT,
      description TEXT,
      searched_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 6. Search History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL UNIQUE,
      result_count INTEGER DEFAULT 0,
      searched_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 7. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings if empty
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  try {
    db.exec(`ALTER TABLE videos ADD COLUMN language TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE channels ADD COLUMN language TEXT;`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE recent_search_videos ADD COLUMN language TEXT;`);
  } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS content_locales (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      channel_title TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (entity_type, entity_id, lang)
    );
  `);

  try {
    db.exec(`
      UPDATE videos
      SET
        title = (
          SELECT cl.title FROM content_locales cl
          WHERE cl.entity_type = 'video' AND cl.entity_id = videos.id AND cl.lang = 'original' AND cl.title != ''
        ),
        description = COALESCE(NULLIF((
          SELECT cl.description FROM content_locales cl
          WHERE cl.entity_type = 'video' AND cl.entity_id = videos.id AND cl.lang = 'original'
        ), ''), videos.description),
        channel_title = COALESCE(NULLIF((
          SELECT cl.channel_title FROM content_locales cl
          WHERE cl.entity_type = 'video' AND cl.entity_id = videos.id AND cl.lang = 'original'
        ), ''), videos.channel_title)
      WHERE EXISTS (
        SELECT 1 FROM content_locales cl
        WHERE cl.entity_type = 'video' AND cl.entity_id = videos.id AND cl.lang = 'original' AND cl.title != ''
      );
    `);
    db.exec(`
      UPDATE channels
      SET
        title = (
          SELECT cl.title FROM content_locales cl
          WHERE cl.entity_type = 'channel' AND cl.entity_id = channels.id AND cl.lang = 'original' AND cl.title != ''
        ),
        description = COALESCE(NULLIF((
          SELECT cl.description FROM content_locales cl
          WHERE cl.entity_type = 'channel' AND cl.entity_id = channels.id AND cl.lang = 'original'
        ), ''), channels.description)
      WHERE EXISTS (
        SELECT 1 FROM content_locales cl
        WHERE cl.entity_type = 'channel' AND cl.entity_id = channels.id AND cl.lang = 'original' AND cl.title != ''
      );
    `);
    db.exec(`DELETE FROM content_locales WHERE lang != 'original'`);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('content_language_mode', 'original');
    restoreTitlesFromDownloadInfo();
  } catch (err: any) {
    console.warn('Could not restore original titles:', err.message);
  }

  insertSetting.run('auto_scan_interval', '60');
  insertSetting.run('default_max_resolution', '1080p');
  insertSetting.run('download_directory', 'downloads');
  insertSetting.run('auto_update_ytdlp', 'true');
  insertSetting.run('concurrent_downloads', '2');
  insertSetting.run('ui_language', 'en');
  insertSetting.run('content_language_mode', 'original');
  insertSetting.run('local_only', 'false');
  insertSetting.run('scan_enabled', 'true');

  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS playlist_videos (
      playlist_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (playlist_id, video_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_playlist_videos_video ON playlist_videos(video_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_videos_position ON playlist_videos(playlist_id, position);
  `);

  // Create indexes for fast queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_is_downloaded ON videos(is_downloaded);
    CREATE INDEX IF NOT EXISTS idx_videos_upload_date ON videos(upload_date);
    CREATE INDEX IF NOT EXISTS idx_videos_channel_downloaded ON videos(channel_id, is_downloaded);
    CREATE INDEX IF NOT EXISTS idx_videos_downloaded_upload ON videos(is_downloaded, upload_date);
    CREATE INDEX IF NOT EXISTS idx_videos_last_watched ON videos(last_watched_at);
    CREATE INDEX IF NOT EXISTS idx_videos_liked ON videos(liked);
    CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status);
  `);

  console.log('✅ SQLite Database initialized with WAL mode at:', DB_PATH);
}

function restoreTitlesFromDownloadInfo() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return;
  const hasOriginal = db.prepare(`
    SELECT 1 AS ok FROM content_locales
    WHERE entity_type = 'video' AND entity_id = ? AND lang = 'original'
  `);
  const updateTitle = db.prepare(`UPDATE videos SET title = ? WHERE id = ? AND (title IS NULL OR title != ?)`);
  const saveOriginal = db.prepare(`
    INSERT INTO content_locales (entity_type, entity_id, lang, title, description, channel_title, updated_at)
    VALUES ('video', ?, 'original', ?, '', '', datetime('now'))
    ON CONFLICT(entity_type, entity_id, lang) DO NOTHING
  `);

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.info.json')) continue;
      try {
        const json = JSON.parse(fs.readFileSync(full, 'utf-8'));
        const id = typeof json.id === 'string' ? json.id : '';
        const title = typeof json.title === 'string' ? json.title.trim() : '';
        if (!id || !title) continue;
        if (hasOriginal.get(id)) continue;
        updateTitle.run(title, id, title);
        saveOriginal.run(id, title);
      } catch (_) {}
    }
  };

  walk(DOWNLOADS_DIR);
}
