/**
 * Migration 011 — Create revoked_tokens table
 *
 * Dipakai untuk JWT blacklist saat logout.
 * Token yang di-revoke disimpan sampai expired, lalu cleanup otomatis.
 *
 * Kolom:
 *  - jti        : JWT ID (unique identifier per token)
 *  - user_id    : pemilik token (untuk cleanup by user jika akun dihapus)
 *  - expires_at : waktu token expired (untuk cleanup job)
 *  - revoked_at : waktu token di-revoke (logout)
 */

export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      id         SERIAL PRIMARY KEY,
      jti        VARCHAR(64)  UNIQUE NOT NULL,
      user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP    NOT NULL,
      revoked_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti
      ON revoked_tokens(jti)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at
      ON revoked_tokens(expires_at)
  `);

  console.log('✓ Created revoked_tokens table with indexes');
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS revoked_tokens CASCADE');
  console.log('✓ Dropped revoked_tokens table (rollback)');
};
