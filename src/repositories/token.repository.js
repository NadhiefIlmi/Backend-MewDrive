import pool from '../config/database.js';

export class TokenRepository {
  /**
   * Simpan token yang di-revoke (saat logout).
   *
   * @param {string} jti        - JWT ID (unique identifier per token)
   * @param {number} userId     - ID user pemilik token
   * @param {Date}   expiresAt  - Waktu token expired (dari JWT claim 'exp')
   */
  async revoke(jti, userId, expiresAt) {
    await pool.query(
      `INSERT INTO revoked_tokens (jti, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, userId, expiresAt]
    );
  }

  /**
   * Cek apakah token sudah di-revoke.
   *
   * @param   {string}  jti
   * @returns {boolean} true jika token ada di blacklist
   */
  async isRevoked(jti) {
    const result = await pool.query(
      'SELECT 1 FROM revoked_tokens WHERE jti = $1 LIMIT 1',
      [jti]
    );
    return result.rowCount > 0;
  }

  /**
   * Hapus token-token yang sudah expired dari blacklist.
   * Dipanggil periodik untuk menjaga ukuran tabel tetap kecil.
   *
   * @returns {number} jumlah baris yang dihapus
   */
  async cleanupExpired() {
    const result = await pool.query(
      'DELETE FROM revoked_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    );
    return result.rowCount;
  }

  /**
   * Revoke semua token milik user tertentu.
   * Berguna saat password di-reset atau akun di-disable.
   *
   * @param {number} userId
   */
  async revokeAllForUser(userId) {
    await pool.query(
      'DELETE FROM revoked_tokens WHERE user_id = $1',
      [userId]
    );
  }
}
