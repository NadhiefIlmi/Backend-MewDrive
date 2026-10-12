import app from './src/app.js';
import { config } from './src/config/env.js';
import pool from './src/config/database.js';
import { TokenRepository } from './src/repositories/token.repository.js';
import { validateEnv } from './src/config/validate-env.js';

// Validasi env vars sebelum apapun — gagal cepat dengan pesan yang jelas
validateEnv();

const PORT = config.port;
const tokenRepository = new TokenRepository();

// ─── Pool warm-up ──────────────────────────────────────────────────────────────
// Pre-connect ke database supaya request pertama tidak lambat karena cold-start pool.
async function warmUpPool() {
  try {
    const warmUpCount = config.env === 'production' ? 5 : 2;
    const clients = await Promise.all(
      Array.from({ length: warmUpCount }, () => pool.connect())
    );
    await Promise.all(clients.map(c => c.query('SELECT 1')));
    clients.forEach(c => c.release());
    console.log(`✓ Connection pool warmed up (${warmUpCount} connections ready)`);
  } catch (err) {
    console.error('❌ Pool warm-up failed:', err.message);
    process.exit(1);
  }
}

// ─── Token blacklist cleanup ───────────────────────────────────────────────────
// Hapus token yang sudah expired dari tabel revoked_tokens.
// Token expired tidak bisa dipakai lagi — tidak perlu disimpan.
async function cleanupExpiredTokens() {
  try {
    const deleted = await tokenRepository.cleanupExpired();
    if (deleted > 0) {
      console.log(`✓ Cleaned up ${deleted} expired revoked token(s)`);
    }
  } catch (err) {
    // Jangan crash server hanya karena cleanup gagal — log saja
    console.error('⚠ Token cleanup failed:', err.message);
  }
}

// ─── Main startup ──────────────────────────────────────────────────────────────
async function startServer() {
  await warmUpPool();

  // Cleanup saat start
  await cleanupExpiredTokens();

  // Cleanup periodik setiap 6 jam
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(cleanupExpiredTokens, SIX_HOURS);

  const server = app.listen(PORT, () => {
    console.log('\n🚀 Backend Server Started');
    console.log(`✓ Environment: ${config.env}`);
    console.log(`✓ Server running on: http://localhost:${PORT}`);
    console.log(`✓ API URL: ${config.apiUrl}/api`);
    console.log(`✓ Health check: http://localhost:${PORT}/api/health\n`);
  });

  // ─── Server timeouts ──────────────────────────────────────────────────────
  // keepAliveTimeout harus lebih panjang dari timeout load balancer (biasanya 60s).
  // Mencegah race condition di mana LB kirim request ke koneksi yang mau ditutup Node.
  server.keepAliveTimeout = config.server.keepAliveTimeoutMs;   // default 65s
  // headersTimeout harus lebih panjang dari keepAliveTimeout
  server.headersTimeout   = config.server.headersTimeoutMs;     // default 66s

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  // Saat SIGTERM/SIGINT:
  //   1. Hentikan terima koneksi baru (server.close)
  //   2. Tunggu request yang sedang berjalan selesai (max shutdownTimeoutMs)
  //   3. Tutup pool database
  //   4. Exit
  const shutdown = (signal) => {
    console.log(`\n${signal} received: closing server gracefully...`);

    // Hard timeout — paksa exit jika shutdown melebihi batas waktu
    const forceExitTimer = setTimeout(() => {
      console.error(`⚠ Graceful shutdown timed out after ${config.server.shutdownTimeoutMs}ms — forcing exit`);
      process.exit(1);
    }, config.server.shutdownTimeoutMs);

    // Jangan biarkan timer ini mencegah process exit normal
    forceExitTimer.unref();

    server.close(() => {
      console.log('✓ HTTP server closed (no new connections accepted)');
      pool.end(() => {
        console.log('✓ Database pool closed');
        clearTimeout(forceExitTimer);
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

startServer();
