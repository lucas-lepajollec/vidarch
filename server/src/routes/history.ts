import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// GET watched videos history
router.get('/videos', (req, res) => {
  try {
    const videos = db.prepare(`
      SELECT v.*, c.avatar_url as channel_avatar, c.handle as channel_handle
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.last_watched_at IS NOT NULL OR v.watch_progress > 0
      ORDER BY COALESCE(v.last_watched_at, v.created_at) DESC
      LIMIT 100
    `).all();

    res.json(videos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET search history
router.get('/searches', (req, res) => {
  try {
    const searches = db.prepare(`
      SELECT * FROM search_history
      ORDER BY searched_at DESC
      LIMIT 50
    `).all();

    res.json(searches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST add search query to history
router.post('/searches', (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Requête vide' });
  }

  try {
    const trimmed = query.trim();
    const id = Buffer.from(trimmed.toLowerCase()).toString('base64').replace(/=/g, '');
    db.prepare(`
      INSERT INTO search_history (id, query, searched_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(query) DO UPDATE SET searched_at = datetime('now')
    `).run(id, trimmed);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE clear all watched videos history
router.delete('/videos', (req, res) => {
  try {
    db.prepare(`
      UPDATE videos 
      SET watch_progress = 0, is_watched = 0, last_watched_at = NULL
      WHERE last_watched_at IS NOT NULL OR watch_progress > 0
    `).run();

    res.json({ success: true, message: 'Historique des vidéos effacé' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE single video from history
router.delete('/videos/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare(`
      UPDATE videos 
      SET watch_progress = 0, is_watched = 0, last_watched_at = NULL
      WHERE id = ?
    `).run(id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE clear all search history
router.delete('/searches', (req, res) => {
  try {
    db.prepare('DELETE FROM search_history').run();
    res.json({ success: true, message: 'Historique des recherches effacé' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE single search query from history
router.delete('/searches/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM search_history WHERE id = ? OR query = ?').run(id, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
