/**
 * Validasi environment variables saat startup.
 *
 * Dipanggil sebelum server.listen() — kalau ada yang kurang,
 * server tidak jalan dan langsung exit dengan pesan yang jelas.
 *
 * Lebih baik gagal dengan pesan jelas di startup daripada crash
 * secara misterius saat sudah menerima request.
 */

export function validateEnv() {
  const errors = [];

  // ─── Wajib di semua environment ──────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  }

  // ─── Peringatan khusus production ────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {

    // JWT_SECRET tidak boleh pakai nilai default
    const defaultSecrets = [
      'your-super-secret-jwt-key',
      'your-super-secret-jwt-key-change-this-in-production',
      'secret',
      'changeme',
    ];
    if (defaultSecrets.some(d => process.env.JWT_SECRET?.includes(d))) {
      errors.push('JWT_SECRET must not use the default value in production');
    }

    // FRONTEND_URL wajib di production (untuk CORS)
    if (!process.env.FRONTEND_URL) {
      errors.push('FRONTEND_URL is required in production (used for CORS)');
    }

    // NODE_ENV harus production
    if (process.env.NODE_ENV !== 'production') {
      errors.push('NODE_ENV must be set to "production"');
    }
  }

  if (errors.length > 0) {
    console.error('\n❌  Environment validation failed:');
    errors.forEach(e => console.error(`   • ${e}`));
    console.error('\n   Fix the issues above before starting the server.\n');
    process.exit(1);
  }
}
