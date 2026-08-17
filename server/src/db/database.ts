import Database from 'better-sqlite3';
import { DB_PATH } from '../config.js';

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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration for is_owner in channels table
  try {
    db.exec(`ALTER TABLE channels ADD COLUMN is_owner INTEGER DEFAULT 0;`);
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
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
    );
  `);

  // Migration for last_watched_at if table already existed
  try {
    db.exec(`ALTER TABLE videos ADD COLUMN last_watched_at TEXT;`);
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

  insertSetting.run('auto_scan_interval', '60');
  insertSetting.run('default_max_resolution', '1080p');
  insertSetting.run('download_directory', 'downloads');
  insertSetting.run('auto_update_ytdlp', 'true');
  insertSetting.run('concurrent_downloads', '1');

  // Create indexes for fast queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_is_downloaded ON videos(is_downloaded);
    CREATE INDEX IF NOT EXISTS idx_videos_upload_date ON videos(upload_date);
    CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status);
  `);

  console.log('✅ SQLite Database initialized with WAL mode at:', DB_PATH);
}
