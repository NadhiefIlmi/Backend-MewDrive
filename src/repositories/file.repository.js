import { query } from '../config/database.js';

export class FileRepository {

  #cols = `
    id, user_id, folder_id, name, original_name,
    mime_type, extension, size, storage_path,
    is_starred, is_trashed, trashed_at,
    last_accessed_at, created_at, updated_at
  `;

  // Hapus storage_path dari row sebelum dikirim ke client.
  // storage_path adalah path fisik di server — tidak boleh bocor ke response API.
  // Controller download/preview mengambil dari DB langsung (bukan lewat service) sehingga
  // mereka masih bisa akses storage_path. Method ini hanya dipakai untuk response publik.
  #sanitize(row) {
    if (!row) return row;
    const { storage_path, ...safe } = row;
    return safe;
  }

  // ─── List file di root atau dalam folder ────────────────────────────────────
  // COUNT(*) OVER() digabung — hemat 1 round-trip DB
  async findByUser(userId, folderId = null, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM files
       WHERE user_id = $1
         AND is_trashed = false
         AND ($2::int IS NULL AND folder_id IS NULL OR folder_id = $2)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, folderId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const files = result.rows.map(({ total_count, ...r }) => this.#sanitize(r));
    return { files, total };
  }

  // ─── List file trashed ──────────────────────────────────────────────────────
  async findTrashedByUser(userId, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM files
       WHERE user_id = $1 AND is_trashed = true
       ORDER BY trashed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const files = result.rows.map(({ total_count, ...r }) => this.#sanitize(r));
    return { files, total };
  }

  // ─── List file starred ──────────────────────────────────────────────────────
  async findStarredByUser(userId, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM files
       WHERE user_id = $1 AND is_starred = true AND is_trashed = false
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const files = result.rows.map(({ total_count, ...r }) => this.#sanitize(r));
    return { files, total };
  }

  // ─── Detail satu file ───────────────────────────────────────────────────────
  async findById(id) {
    const result = await query(
      `SELECT ${this.#cols} FROM files WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── Cek nama duplikat ──────────────────────────────────────────────────────
  async existsByName(userId, name, folderId, excludeId = null) {
    const result = await query(
      `SELECT 1 FROM files
       WHERE user_id = $1
         AND name = $2
         AND is_trashed = false
         AND ($3::int IS NULL AND folder_id IS NULL OR folder_id = $3)
         AND ($4::int IS NULL OR id <> $4)
       LIMIT 1`,
      [userId, name, folderId, excludeId]
    );
    return result.rows.length > 0;
  }

  // ─── Insert metadata file ───────────────────────────────────────────────────
  async create({ userId, folderId = null, name, originalName, mimeType, extension, size, storagePath }) {
    const result = await query(
      `INSERT INTO files
         (user_id, folder_id, name, original_name, mime_type, extension, size, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${this.#cols}`,
      [userId, folderId, name, originalName, mimeType, extension, size, storagePath]
    );
    return this.#sanitize(result.rows[0]);
  }

  // ─── Update nama / starred ──────────────────────────────────────────────────
  async update(id, { name, is_starred }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name       !== undefined) { fields.push(`name = $${idx++}`);       values.push(name); }
    if (is_starred !== undefined) { fields.push(`is_starred = $${idx++}`); values.push(is_starred); }

    if (fields.length === 0) return this.#sanitize(await this.findById(id));

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE files SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${this.#cols}`,
      values
    );
    return this.#sanitize(result.rows[0] ?? null);
  }

  // ─── Soft-delete (trash) ────────────────────────────────────────────────────
  async trash(id) {
    const result = await query(
      `UPDATE files
       SET is_trashed = true, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${this.#cols}`,
      [id]
    );
    return this.#sanitize(result.rows[0] ?? null);
  }

  // ─── Restore dari trash ─────────────────────────────────────────────────────
  async restore(id) {
    const result = await query(
      `UPDATE files
       SET is_trashed = false, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${this.#cols}`,
      [id]
    );
    return this.#sanitize(result.rows[0] ?? null);
  }

  // ─── Pindah file ke folder baru ─────────────────────────────────────────────
  async move(id, newFolderId) {
    const result = await query(
      `UPDATE files
       SET folder_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING ${this.#cols}`,
      [newFolderId, id]
    );
    return this.#sanitize(result.rows[0] ?? null);
  }

  // ─── Hapus permanen ─────────────────────────────────────────────────────────
  async deletePermanent(id) {
    const result = await query(
      `DELETE FROM files WHERE id = $1 RETURNING id, name, size, storage_path`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── List file recently accessed/created ────────────────────────────────────
  async findRecentByUser(userId, limit = 20) {
    const result = await query(
      `SELECT ${this.#cols}
       FROM files
       WHERE user_id = $1 AND is_trashed = false
       ORDER BY GREATEST(COALESCE(last_accessed_at, created_at), created_at) DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(r => this.#sanitize(r));
  }

  // ─── Touch last_accessed_at ─────────────────────────────────────────────────
  async touchAccessed(id) {
    await query(
      `UPDATE files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  // ─── Total size file aktif (quota) ──────────────────────────────────────────
  async sumSizeByUser(userId) {
    const result = await query(
      `SELECT COALESCE(SUM(size), 0)::bigint AS total
       FROM files
       WHERE user_id = $1 AND is_trashed = false`,
      [userId]
    );
    return Number(result.rows[0].total);
  }

  // ─── File dalam folder-folder tertentu (untuk cascade trash/delete) ─────────
  async findByFolderIds(folderIds) {
    if (folderIds.length === 0) return [];
    const result = await query(
      `SELECT ${this.#cols}
       FROM files
       WHERE folder_id = ANY($1::int[])`,
      [folderIds]
    );
    return result.rows;
  }
}
