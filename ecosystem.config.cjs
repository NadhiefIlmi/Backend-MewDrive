/**
 * PM2 Ecosystem Config — Production Process Manager
 *
 * PM2 menjaga server tetap hidup:
 * - Auto-restart kalau crash
 * - Zero-downtime reload saat update
 * - Log management
 * - Process monitoring
 *
 * Install PM2: npm install -g pm2
 *
 * Cara pakai:
 *   pm2 start ecosystem.config.cjs          # start
 *   pm2 reload ecosystem.config.cjs         # reload tanpa downtime
 *   pm2 stop mydrive-backend                # stop
 *   pm2 logs mydrive-backend                # lihat log
 *   pm2 monit                               # dashboard monitoring
 *   pm2 startup                             # auto-start saat server reboot
 */

module.exports = {
  apps: [
    {
      name: 'mydrive-backend',
      script: 'server.js',

      // ─── Instance & scaling ─────────────────────────────────────────────────
      // instances: 1 untuk server dengan 1 CPU, 'max' untuk pakai semua CPU core
      // Untuk 2-10 user, 1 instance sudah lebih dari cukup
      instances: 1,
      exec_mode: 'fork', // ganti ke 'cluster' kalau instances > 1

      // ─── Environment ────────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      // ─── Restart behavior ───────────────────────────────────────────────────
      // Restart otomatis kalau crash, maksimal 10 kali dalam 1 menit
      // Setelah 10 kali, PM2 berhenti restart (untuk hindari restart loop)
      max_restarts: 10,
      min_uptime: '5s',    // proses harus hidup minimal 5 detik untuk dianggap stable
      restart_delay: 1000, // tunggu 1 detik sebelum restart

      // ─── Memory limit ───────────────────────────────────────────────────────
      // Restart otomatis kalau memory melebihi 500MB
      // Melindungi server dari memory leak yang lambat
      max_memory_restart: '500M',

      // ─── Logging ────────────────────────────────────────────────────────────
      out_file: './logs/app.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ─── Watch (development only) ────────────────────────────────────────────
      // Di production jangan pakai watch — bisa trigger restart karena log file berubah
      watch: false,

      // ─── Graceful shutdown ───────────────────────────────────────────────────
      // Beri waktu 15 detik untuk selesaikan request yang sedang berjalan
      // sebelum PM2 paksa kill (harus lebih dari SHUTDOWN_TIMEOUT_MS di server.js)
      kill_timeout: 15000,

      // ─── Node.js args ───────────────────────────────────────────────────────
      // --max-old-space-size mencegah Node dari pakai RAM terlalu banyak
      node_args: '--max-old-space-size=512',
    },
  ],
};
