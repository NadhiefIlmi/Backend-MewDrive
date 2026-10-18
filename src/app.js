import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { config } from './config/env.js';

const app = express();

// ─── Compression ─────────────────────────────────────────────────────────────
// Kompres response JSON sebelum dikirim ke client.
// Response 100KB bisa jadi ~10KB → transfer lebih cepat, bandwidth hemat.
// Tidak dikompres: file binary (gambar, video) karena sudah terkompresi.
app.use(compression({
  level: 6,        // 1–9, makin tinggi makin kecil tapi lebih berat CPU. 6 = sweet spot
  threshold: 1024, // hanya kompres jika response > 1KB (overhead tidak sepadan untuk response kecil)
  filter: (req, res) => {
    // Jangan kompres file upload/download/preview — sudah binary, tidak perlu
    if (req.path.includes('/download') || req.path.includes('/preview')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false,  // file preview/download butuh cross-origin fetch
  crossOriginEmbedderPolicy: false,  // PDF iframe di share page butuh ini off
  contentSecurityPolicy: false,      // CSP dikelola di frontend (Vite) — skip di API
  // frameguard: re-enabled dengan SAMEORIGIN
  // Mencegah halaman ini di-embed di iframe dari domain lain
  frameguard: { action: 'sameorigin' },
}));

// CORS — development: izinkan semua, production: hanya dari FRONTEND_URL atau CORS_ORIGINS
// Task 14: support CORS_ORIGINS env untuk multi-domain production
const buildAllowedOrigins = () => {
  if (config.env === 'development') return true; // izinkan semua origin di development

  // Support comma-separated CORS_ORIGINS untuk multi-domain
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    return corsOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  return [config.frontendUrl].filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
}));

// ─── Logging ──────────────────────────────────────────────────────────────────
// Development: log semua request dengan format singkat
// Production: log hanya error (4xx/5xx) — tidak perlu log setiap request sukses
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
  }));
}

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(generalRateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
