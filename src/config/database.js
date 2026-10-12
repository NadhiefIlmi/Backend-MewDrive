import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

const isProduction = config.env === 'production';

// ─── Pool defaults per environment ─────────────────────────────────────────────
// Production: lebih banyak koneksi, pre-warm minimal 5
// Development: hemat resource — max 5, min 1
const DEFAULT_POOL_MAX = isProduction ? 20 : 5;
const DEFAULT_POOL_MIN = isProduction ? 5  : 1;

// ─── Create connection pool ────────────────────────────────────────────────────
export const pool = new Pool({
  connectionString: config.database.url,
  max:                    config.database.poolMax          || DEFAULT_POOL_MAX,
  min:                    config.database.poolMin          || DEFAULT_POOL_MIN,
  idleTimeoutMillis:      config.database.idleTimeoutMs,      // default 30s
  connectionTimeoutMillis: config.database.connectTimeoutMs,  // default 5s

  // TCP keep-alive — cegah idle connection diputus silently oleh OS/firewall/cloud
  // Penting untuk koneksi long-running di production
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // mulai probe setelah 10 detik idle

  // statement_timeout — batasi berapa lama satu query boleh berjalan
  // Mencegah query besar yang nyangkut memblok pool connection
  // Dikonfigurasi via env var, default 10 detik
  options: `--statement_timeout=${config.database.statementTimeoutMs}`,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
  // Jangan exit(1) di sini — biarkan pool recovery sendiri untuk koneksi yang putus.
  // process.exit hanya pantas saat initial connect gagal (lihat warmUpPool di server.js)
});

// ─── Query helper ──────────────────────────────────────────────────────────────
// Wrapper tipis dengan timing log (development only) dan konsisten error propagation.
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (!isProduction) {
      const duration = Date.now() - start;
      if (duration > 100) {
        // Hanya log query yang lambat (>100ms) di development — hindari noise
        console.log(`[DB slow] ${duration}ms: ${text.substring(0, 80)}`);
      }
    }
    return res;
  } catch (error) {
    if (!isProduction) {
      console.error('[DB error]', error.message, '|', text.substring(0, 80));
    }
    throw error;
  }
};

// ─── Transaction helper ────────────────────────────────────────────────────────
// Ambil client dari pool, jalankan callback dalam BEGIN/COMMIT/ROLLBACK,
// pastikan client selalu di-release ke pool meski ada error.
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
