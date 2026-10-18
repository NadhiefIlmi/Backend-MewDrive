import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  // URL frontend — dipakai untuk CORS di production
  // Set FRONTEND_URL di .env production ke domain frontend kamu
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  database: {
    url: process.env.DATABASE_URL || 'postgres://ptsiagaabdiutama:@127.0.0.1:5432/purrdocs',
    // Pool tuning — bisa di-override via env vars
    poolMax: parseInt(process.env.DB_POOL_MAX) || 0,         // 0 = gunakan default per-env (5 dev, 20 prod)
    poolMin: parseInt(process.env.DB_POOL_MIN) || 0,         // 0 = gunakan default per-env (1 dev, 5 prod)
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
    connectTimeoutMs: parseInt(process.env.DB_CONNECT_TIMEOUT_MS) || 5000,
    statementTimeoutMs: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS) || 10000, // 10 detik max per query
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5
  },
  
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || './storage/files'
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'debug'
  },

  server: {
    // Berapa lama (ms) tunggu request yang sedang berjalan selesai saat graceful shutdown
    // Setelah timeout ini, proses dipaksa keluar
    shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS) || 10000,
    // Keep-alive timeout — lebih panjang dari load balancer (biasanya 60s) untuk hindari race condition
    keepAliveTimeoutMs: parseInt(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65000,
    // Headers timeout — harus lebih panjang dari keepAliveTimeout
    headersTimeoutMs: parseInt(process.env.HEADERS_TIMEOUT_MS) || 66000,
  },

  cache: {
    // TTL in-memory cache (ms) untuk data yang sering dibaca ulang (metadata file, storage info)
    fileTtlMs: parseInt(process.env.CACHE_FILE_TTL_MS) || 30000,     // 30 detik
    storageTtlMs: parseInt(process.env.CACHE_STORAGE_TTL_MS) || 10000, // 10 detik
  },

  telegramEncryptionKey: process.env.TELEGRAM_ENCRYPTION_KEY ?? '',
};

