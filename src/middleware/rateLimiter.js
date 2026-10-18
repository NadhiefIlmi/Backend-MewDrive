import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

// ─── Login rate limiter ────────────────────────────────────────────────────────
// 5 percobaan login GAGAL per 15 menit per IP
// Login sukses tidak dihitung (skipSuccessfulRequests: true)
// Di development/test, naikkan limit supaya test suite bisa jalan berulang
const isDevOrTest = process.env.NODE_ENV !== 'production';

export const loginRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,   // default 15 menit
  max: isDevOrTest ? 100 : config.rateLimit.maxRequests,  // dev: 100, prod: 5
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip,
});

// ─── General rate limiter ──────────────────────────────────────────────────────
// 100 request per menit per IP — proteksi umum untuk semua endpoint
// Di test, naikkan limit supaya integration test suite tidak kena throttle.
// Set GENERAL_RATE_LIMIT_MAX=1000 di .env untuk testing.
const generalRateMax = parseInt(process.env.GENERAL_RATE_LIMIT_MAX) || 100;

export const generalRateLimiter = rateLimit({
  windowMs: 60_000,  // 1 menit
  max: generalRateMax,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Upload rate limiter ───────────────────────────────────────────────────────
// 20 upload per menit per IP
// Di dev/test naikkan limit supaya test suite tidak kena throttle
export const uploadRateLimiter = rateLimit({
  windowMs: 60_000,  // 1 menit
  max: isDevOrTest ? 200 : 20,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Upload limit reached. Please wait before uploading more files.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// ─── Share link rate limiter ───────────────────────────────────────────────────
// 10 share link baru per menit per IP
// Mencegah pembuatan share link massal
export const shareRateLimiter = rateLimit({
  windowMs: 60_000,  // 1 menit
  max: 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many share links created. Please wait before creating more.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// ─── Task rate limiter ─────────────────────────────────────────────────────────
// 60 task baru per menit per user — proteksi dari spam create
export const taskRateLimiter = rateLimit({
  windowMs: 60_000,
  max: isDevOrTest ? 200 : 60,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak task dibuat. Tunggu sebentar.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `task_${req.user?.id ?? req.ip}`,
});

// ─── Telegram rate limiter ─────────────────────────────────────────────────────
// 10 request per jam per user — cegah brute-force token orang lain
export const telegramRateLimiter = rateLimit({
  windowMs: 60 * 60_000,  // 1 jam
  max: isDevOrTest ? 100 : 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan koneksi Telegram. Coba lagi dalam 1 jam.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `telegram_${req.user?.id ?? req.ip}`,
});

