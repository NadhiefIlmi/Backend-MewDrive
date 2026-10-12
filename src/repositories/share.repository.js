import { query } from '../config/database.js';
import crypto from 'crypto';

export class ShareRepository {
  // Generate token unik 32 hex chars
  #generateToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Cari share link berdasarkan token — join ke files untuk info file
  async findByToken(token) {
    const result = await query(
      `SELECT
         sl.id, sl.token, sl.is_active, sl.expires_at, sl.created_at,
         f.id AS file_id, f.name, f.original_name, f.mime_type,
         f.extension, f.size, f.storage_path, f.is_trashed
       FROM share_links sl
       JOIN files f ON sl.file_id = f.id
       WHERE sl.token = $1`,
      [token]
    );
    return result.rows[0] ?? null;
  }

  // Cari share link aktif milik user untuk file tertentu
  async findByFileAndUser(fileId, userId) {
    const result = await query(
      `SELECT id, token, is_active, expires_at, created_at
       FROM share_links
       WHERE file_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [fileId, userId]
    );
    return result.rows[0] ?? null;
  }

  // List semua share link milik user
  async findByUser(userId) {
    const result = await query(
      `SELECT
         sl.id, sl.token, sl.is_active, sl.expires_at, sl.created_at,
         f.id AS file_id, f.name, f.extension, f.size, f.mime_type
       FROM share_links sl
       JOIN files f ON sl.file_id = f.id
       WHERE sl.user_id = $1
       ORDER BY sl.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  // Buat share link baru (atau reuse jika sudah ada)
  async create(fileId, userId, expiresAt = null) {
    const token = this.#generateToken();
    const result = await query(
      `INSERT INTO share_links (file_id, user_id, token, is_active, expires_at)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, token, is_active, expires_at, created_at`,
      [fileId, userId, token, expiresAt]
    );
    return result.rows[0];
  }

  // Toggle aktif/nonaktif
  async setActive(id, userId, isActive) {
    const result = await query(
      `UPDATE share_links SET is_active = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, token, is_active, expires_at`,
      [isActive, id, userId]
    );
    return result.rows[0] ?? null;
  }

  // Hapus share link
  async delete(id, userId) {
    const result = await query(
      `DELETE FROM share_links WHERE id = $1 AND user_id = $2
       RETURNING id, token`,
      [id, userId]
    );
    return result.rows[0] ?? null;
  }
}
