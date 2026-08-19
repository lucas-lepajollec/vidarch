import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PORT, DOWNLOADS_DIR, ASSETS_DIR, ROOT_DIR, IS_PROD, DB_PATH } from './config.js';
import { initDatabase, db } from './db/database.js';
import { authGuard } from './middleware/auth.js';
import { isAuthRequired } from './services/auth.js';
import { ensureYoutubeThumb, ensureChannelAvatar, ensureChannelBanner, pruneRemoteImageCache } from './utils/remoteImages.js';
import cron from 'node-cron';
import { isYouTubeVideoId } from './utils/youtube.js';
import { updateYtDlp } from './services/ytdlp.js';
import { scannerService } from './services/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import searchRoutes from './routes/search.js';
import channelsRoutes from './routes/channels.js';
import videosRoutes from './routes/videos.js';
import downloadsRoutes from './routes/downloads.js';
import systemRoutes from './routes/system.js';
import historyRoutes from './routes/history.js';
import importRoutes from './routes/import.js';
import authRoutes from './routes/auth.js';

initDatabase();

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.ytimg.com",
        "https://*.ggpht.com",
        "https://*.googleusercontent.com",
        "https://*.youtube.com",
      ],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques instants.' },
});
app.use('/api/', globalApiLimiter);

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de recherche atteinte, veuillez patienter une minute.' },
});
app.use('/api/search', searchLimiter);

const heavyOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Opération fréquente, veuillez patienter avant de relancer.' },
});
app.use('/api/system/update-ytdlp', heavyOpsLimiter);
app.use('/api/system/scan', heavyOpsLimiter);
app.use('/api/import', heavyOpsLimiter);

app.use(authGuard);

app.get('/media/thumb/:id', async (req, res) => {
  const id = String(req.params.id || '').replace(/\.(jpg|jpeg|webp|png)$/i, '');
  if (!isYouTubeVideoId(id)) return res.status(400).end();
  try {
    const file = await ensureYoutubeThumb(id);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.resolve(file));
  } catch {
    res.status(404).end();
  }
});

app.get('/media/avatar/:id', async (req, res) => {
  const id = String(req.params.id || '').slice(0, 80);
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return res.status(400).end();
  try {
    const file = await ensureChannelAvatar(id, typeof req.query.u === 'string' ? req.query.u : '');
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.resolve(file));
  } catch {
    res.status(404).end();
  }
});

app.get('/media/banner/:id', async (req, res) => {
  const id = String(req.params.id || '').slice(0, 80);
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return res.status(400).end();
  try {
    const file = await ensureChannelBanner(id, typeof req.query.u === 'string' ? req.query.u : '');
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.resolve(file));
  } catch {
    res.status(404).end();
  }
});

app.use('/media/downloads', express.static(DOWNLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));
app.use('/media/assets', express.static(ASSETS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/import', importRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const possibleDistPaths = [
  path.join(ROOT_DIR, 'client/dist'),
  path.join(__dirname, '../../client/dist'),
  path.join(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve('/app/client/dist'),
];

let clientDistPath = '';
for (const p of possibleDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    clientDistPath = p;
    break;
  }
}

if (clientDistPath) {
  console.log(`Serving static client from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/media')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
} else if (IS_PROD) {
  console.warn('No static client dist found at standard paths');
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server Error:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = IS_PROD
    ? 'Une erreur interne est survenue sur le serveur'
    : err.message || 'Erreur interne';
  res.status(status).json({ error: message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VidArch Server running on http://0.0.0.0:${PORT} [${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  console.log(`Downloads directory: ${DOWNLOADS_DIR}`);
  console.log(`Database: ${DB_PATH}`);
  if (!isAuthRequired()) {
    console.warn('AUTH: no password configured. Set AUTH_PASSWORD or a password in Settings before exposing this host.');
  }
  bootstrapBackgroundJobs();
});

function readSetting(key: string, fallback: string): string {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}

function bootstrapBackgroundJobs() {
  scannerService.initCron();

  const autoUpdate = readSetting('auto_update_ytdlp', 'true') !== 'false';
  if (autoUpdate) {
    setTimeout(() => {
      updateYtDlp()
        .then((r) => console.log('yt-dlp auto-update:', r.message))
        .catch((err) => console.warn('yt-dlp auto-update failed:', err.message));
    }, 2500);
  }

  const runImageCachePrune = () => {
    try {
      const result = pruneRemoteImageCache();
      if (result.deleted > 0 || result.trimmed > 0) {
        console.log(`Image cache prune: deleted ${result.deleted} files, kept ${result.kept}, trimmed ${result.trimmed} catalog rows`);
      }
    } catch (err: any) {
      console.warn('Image cache prune failed:', err?.message || err);
    }
  };
  setTimeout(runImageCachePrune, 45_000);
  cron.schedule('20 4 * * *', runImageCachePrune);
}

export default app;
