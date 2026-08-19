import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database.js';
import { COOKIES_FILE, DOWNLOADS_DIR, findYtDlpPath } from '../config.js';
import { getYtDlpVersion, updateYtDlp } from '../services/ytdlp.js';
import { scannerService } from '../services/scanner.js';
import { downloadQueue } from '../services/queue.js';
import { isScanEnabled } from '../utils/settings.js';

const router = Router();

const ALLOWED_SETTINGS = new Set([
  'auto_scan_interval',
  'default_max_resolution',
  'auto_update_ytdlp',
  'concurrent_downloads',
  'auto_download_new_subs',
  'download_shorts_default',
  'ui_language',
  'local_only',
  'scan_enabled',
]);

const COOKIES_MAX_BYTES = 2 * 1024 * 1024;

function getDirectorySize(dirPath: string): number {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getDirectorySize(filePath);
      } else {
        size += stat.size;
      }
    }
  } catch (_) {}
  return size;
}

// Format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// GET system health & statistics
router.get('/status', async (req, res) => {
  try {
    const ytdlpVersion = await getYtDlpVersion();
    const hasCookies = fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 0;
    
    const downloadedCount = (db.prepare('SELECT count(*) as count FROM videos WHERE is_downloaded = 1').get() as any).count;
    const channelsCount = (db.prepare('SELECT count(*) as count FROM subscriptions').get() as any).count;
    const totalDetected = (db.prepare('SELECT count(*) as count FROM videos').get() as any).count;

    const storageSizeBytes = getDirectorySize(DOWNLOADS_DIR);
    const storageFormatted = formatBytes(storageSizeBytes);

    res.json({
      ytdlpVersion,
      ytdlpPath: findYtDlpPath(),
      hasCookies,
      downloadedCount,
      channelsCount,
      totalDetected,
      storageSizeBytes,
      storageFormatted,
      downloadsDir: DOWNLOADS_DIR,
      isScanning: scannerService.getStatus().isScanning,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST update yt-dlp
router.post('/update-ytdlp', async (req, res) => {
  try {
    const result = await updateYtDlp();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger manual scan of subscriptions
router.post('/scan', async (req, res) => {
  try {
    const result = await scannerService.scanAllSubscriptions({ forceFull: isScanEnabled() });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST save cookies.txt
router.post('/cookies', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Contenu du cookie requis' });
  }
  if (content.length > COOKIES_MAX_BYTES) {
    return res.status(400).json({ error: 'Fichier cookies trop volumineux' });
  }
  if (!/netscape|# http|youtube\.com/i.test(content)) {
    return res.status(400).json({ error: 'Format cookies.txt Netscape invalide' });
  }

  try {
    fs.writeFileSync(COOKIES_FILE, content, 'utf-8');
    res.json({ success: true, message: 'Fichier cookies.txt enregistré avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cookies.txt (Revert to anonymous)
router.delete('/cookies', (req, res) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }
    res.json({ success: true, message: 'Fichier cookies supprimé. Mode anonyme actif.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST cleanup cache & compact DB
router.post('/cleanup-cache', (req, res) => {
  try {
    const delSearch = db.prepare(`DELETE FROM search_history WHERE searched_at < datetime('now', '-7 days')`).run();
    const delOrphanVideos = db.prepare(`
      DELETE FROM videos 
      WHERE is_downloaded = 0 
        AND channel_id NOT IN (SELECT channel_id FROM subscriptions)
        AND created_at < datetime('now', '-7 days')
    `).run();
    const delOrphanChannels = db.prepare(`
      DELETE FROM channels 
      WHERE id NOT IN (SELECT channel_id FROM subscriptions)
        AND id NOT IN (SELECT DISTINCT channel_id FROM videos WHERE is_downloaded = 1)
        AND updated_at < datetime('now', '-7 days')
    `).run();

    try {
      db.pragma('incremental_vacuum');
    } catch (_) {}

    res.json({
      success: true,
      cleanedSearchHistory: delSearch.changes,
      cleanedVideos: delOrphanVideos.changes,
      cleanedChannels: delOrphanChannels.changes,
      message: 'Cache nettoyé et base de données optimisée.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET / PUT settings
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ error: 'Objet de paramètres requis' });
  }
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const updateMany = db.transaction((obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) {
        if (!ALLOWED_SETTINGS.has(k)) continue;
        const value = String(v);
        if (k === 'ui_language' && !['en', 'fr', 'es', 'de'].includes(value)) continue;
        if (k === 'local_only' && !['true', 'false'].includes(value)) continue;
        if (k === 'scan_enabled' && !['true', 'false'].includes(value)) continue;
        if (k === 'concurrent_downloads') {
          const n = parseInt(value, 10);
          if (!Number.isFinite(n) || n < 1 || n > 4) continue;
          stmt.run(k, String(Math.round(n)));
          continue;
        }
        stmt.run(k, value);
      }
    });
    updateMany(settings);
    if (settings.auto_scan_interval !== undefined) {
      scannerService.initCron();
    }
    if (settings.concurrent_downloads !== undefined) {
      downloadQueue.processNext();
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
