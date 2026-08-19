import { Router, Response } from 'express';
import { downloadQueue } from '../services/queue.js';
import { getVideoDetails } from '../services/ytdlp.js';

const router = Router();

// Store active SSE clients
const sseClients = new Set<Response>();

// Broadcast helper
function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Connect queue events to SSE
downloadQueue.on('queue_updated', (queue) => {
  broadcast('queue', queue);
});

downloadQueue.on('task_progress', (prog) => {
  broadcast('progress', prog);
});

downloadQueue.on('task_completed', (data) => {
  broadcast('completed', data);
});

downloadQueue.on('task_failed', (data) => {
  broadcast('failed', data);
});

// SSE endpoint with reverse-proxy buffering disabled and keep-alive ping
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Critical for Nginx / Docker / Reverse proxies
  });

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  sseClients.add(res);

  // Send current queue immediately
  try {
    res.write(`event: queue\ndata: ${JSON.stringify(downloadQueue.getQueue())}\n\n`);
  } catch (_) {}

  // Keep-alive heartbeat ping every 15 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (_) {
      clearInterval(pingInterval);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.delete(res);
  });
});

// GET current download queue
router.get('/queue', (req, res) => {
  res.json(downloadQueue.getQueue());
});

// GET download tasks (alias for compatibility)
router.get('/tasks', (req, res) => {
  res.json(downloadQueue.getQueue());
});

// GET active download tasks
router.get('/active', (req, res) => {
  const all = downloadQueue.getQueue();
  const active = all.filter(t => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued');
  res.json(active);
});

// POST add video to queue
router.post('/', async (req, res) => {
  const { videoId, url, title, channelTitle, channelId, thumbnailUrl, resolution } = req.body;

  if (!videoId && !url) {
    return res.status(400).json({ error: 'Identifiant ou URL de vidéo requis' });
  }

  try {
    let videoTitle = title;
    let videoChannel = channelTitle;
    let videoChannelId = channelId;
    let videoThumb = thumbnailUrl;

    // If metadata not provided, fetch quickly
    if (!videoTitle) {
      try {
        const info = await getVideoDetails(url || videoId);
        videoTitle = info.title;
        videoChannel = info.channelTitle;
        videoChannelId = info.channelId;
        videoThumb = info.thumbnailUrl;
      } catch (_) {}
    }

    const item = downloadQueue.addToQueue({
      id: videoId || url,
      url: url || (videoId?.startsWith('http') ? videoId : `https://www.youtube.com/watch?v=${videoId}`),
      title: videoTitle || 'Téléchargement YouTube',
      channelTitle: videoChannel,
      channelId: videoChannelId,
      thumbnailUrl: videoThumb,
      resolution: resolution || '1080p',
    });

    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST cancel task
router.post('/:id/cancel', (req, res) => {
  downloadQueue.cancelTask(req.params.id);
  res.json({ success: true });
});

// POST retry task
router.post('/:id/retry', (req, res) => {
  downloadQueue.retryTask(req.params.id);
  res.json({ success: true });
});

// DELETE task
router.delete('/:id', (req, res) => {
  downloadQueue.deleteItem(req.params.id);
  res.json({ success: true });
});

// POST clear completed
router.post('/clear', (req, res) => {
  downloadQueue.clearCompleted();
  res.json({ success: true });
});

export default router;
