import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { PORT, DOWNLOADS_DIR, DATA_DIR, ROOT_DIR, IS_PROD, DB_PATH } from './config.js';
import { initDatabase } from './db/database.js';

// Import route handlers
import searchRoutes from './routes/search.js';
import channelsRoutes from './routes/channels.js';
import videosRoutes from './routes/videos.js';
import downloadsRoutes from './routes/downloads.js';
import systemRoutes from './routes/system.js';
import historyRoutes from './routes/history.js';
import importRoutes from './routes/import.js';

// Initialize SQLite database
initDatabase();

const app = express();

// Trust reverse proxies (Nginx, Caddy, Cloudflare, Traefik)
app.set('trust proxy', 1);

// Security Headers with tailored Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: [
        "'self'", 
        "data:", 
        "blob:", 
        "https://*.ytimg.com", 
        "https://*.ggpht.com", 
        "https://*.googleusercontent.com", 
        "https://*.youtube.com"
      ],
      mediaSrc: ["'self'", "data:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://*.youtube.com", 
        "https://*.googlevideo.com"
      ],
      frameSrc: [
        "'self'", 
        "https://www.youtube-nocookie.com", 
        "https://www.youtube.com"
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Performance Compression (Gzip / Deflate)
app.use(compression());

// Standard CORS & Body Parsers
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Rate Limiting (DDoS & Brute-Force Protection)
// ============================================================================

// Global API Limiter: 150 req/min per IP
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer dans quelques instants.' },
});
app.use('/api/', globalApiLimiter);

// Search Limiter: 30 req/min per IP (protects YouTube IP & server CPU)
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de recherche atteinte, veuillez patienter une minute.' },
});
app.use('/api/search', searchLimiter);

// Heavy operations limiter: 10 req/min per IP
const heavyOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Opération fréquente, veuillez patienter avant de relancer.' },
});
app.use('/api/system/update-ytdlp', heavyOpsLimiter);
app.use('/api/system/scan', heavyOpsLimiter);

// ============================================================================
// Media & Static File Serving
// ============================================================================
app.use('/media/downloads', express.static(DOWNLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));
app.use('/media/data', express.static(DATA_DIR));

// API Routes
app.use('/api/search', searchRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/import', importRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), environment: IS_PROD ? 'production' : 'development' });
});

// Production: serve static React build from client/dist
const clientDistPath = path.join(ROOT_DIR, 'client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/media')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Centralized safe error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('🔥 Server Error:', err);
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = IS_PROD 
    ? 'Une erreur interne est survenue sur le serveur' 
    : err.message || 'Erreur interne';
  res.status(status).json({ error: message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VidArch Server running on http://0.0.0.0:${PORT} [${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  console.log(`📂 Downloads directory: ${DOWNLOADS_DIR}`);
  console.log(`💾 Database: ${DB_PATH}`);
});

export default app;
