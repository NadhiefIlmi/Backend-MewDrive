import { query } from '../config/database.js';

export class FolderRepository {

  // ─── Base select fields ────────────────────────────────────────────────────
  #cols = `
    id, user_id, parent_id, name, color, icon,
    is_starred, is_trashed, trashed_at,
    created_at, updated_at
  `;

  // ─── List folder di root atau dalam parent ─────────────────────────────────
  // COUNT(*) OVER() digabung dalam satu query — hemat 1 round-trip DB
  async findByUser(userId, parentId = null, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM folders
       WHERE user_id = $1
         AND is_trashed = false
         AND ($2::int IS NULL AND parent_id IS NULL OR parent_id = $2)
       ORDER BY name ASC
       LIMIT $3 OFFSET $4`,
      [userId, parentId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const folders = result.rows.map(({ total_count, ...r }) => r);
    return { folders, total };
  }

  // ─── List folder trashed ────────────────────────────────────────────────────
  async findTrashedByUser(userId, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM folders
       WHERE user_id = $1 AND is_trashed = true
       ORDER BY trashed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const folders = result.rows.map(({ total_count, ...r }) => r);
    return { folders, total };
  }

  // ─── List folder starred ────────────────────────────────────────────────────
  async findStarredByUser(userId, { limit = 50, offset = 0 } = {}) {
    const result = await query(
      `SELECT ${this.#cols},
              COUNT(*) OVER() AS total_count
       FROM folders
       WHERE user_id = $1 AND is_starred = true AND is_trashed = false
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const folders = result.rows.map(({ total_count, ...r }) => r);
    return { folders, total };
  }

  // ─── Detail satu folder ─────────────────────────────────────────────────────
  async findById(id) {
    const result = await query(
      `SELECT ${this.#cols} FROM folders WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── Cek nama duplikat ──────────────────────────────────────────────────────
  async existsByName(userId, name, parentId, excludeId = null) {
    const result = await query(
      `SELECT 1 FROM folders
       WHERE user_id = $1
         AND name = $2
         AND is_trashed = false
         AND ($3::int IS NULL AND parent_id IS NULL OR parent_id = $3)
         AND ($4::int IS NULL OR id <> $4)
       LIMIT 1`,
      [userId, name, parentId, excludeId]
    );
    return result.rows.length > 0;
  }

  // ─── Buat folder baru ───────────────────────────────────────────────────────
  async create({ userId, parentId = null, name, color = 'default', icon = 'folder' }) {
    const result = await query(
      `INSERT INTO folders (user_id, parent_id, name, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${this.#cols}`,
      [userId, parentId, name, color, icon]
    );
    return result.rows[0];
  }

  // ─── Update folder ──────────────────────────────────────────────────────────
  async update(id, { name, color, icon, is_starred }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name       !== undefined) { fields.push(`name = $${idx++}`);       values.push(name); }
    if (color      !== undefined) { fields.push(`color = $${idx++}`);      values.push(color); }
    if (icon       !== undefined) { fields.push(`icon = $${idx++}`);       values.push(icon); }
    if (is_starred !== undefined) { fields.push(`is_starred = $${idx++}`); values.push(is_starred); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE folders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${this.#cols}`,
      values
    );
    return result.rows[0] ?? null;
  }

  // ─── Soft-delete (trash) ────────────────────────────────────────────────────
  async trash(id) {
    const result = await query(
      `UPDATE folders
       SET is_trashed = true, trashed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${this.#cols}`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── Restore dari trash ─────────────────────────────────────────────────────
  async restore(id) {
    const result = await query(
      `UPDATE folders
       SET is_trashed = false, trashed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${this.#cols}`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── Hapus permanen ─────────────────────────────────────────────────────────
  async deletePermanent(id) {
    const result = await query(
      `DELETE FROM folders WHERE id = $1 RETURNING id, name`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // ─── Pindah folder ke parent baru ──────────────────────────────────────────
  async move(id, newParentId) {
    const result = await query(
      `UPDATE folders
       SET parent_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING ${this.#cols}`,
      [newParentId, id]
    );
    return result.rows[0] ?? null;
  }

  // ─── List semua descendant ID (recursive CTE) ───────────────────────────────
  // Dipakai saat trash/delete folder — perlu tau semua subfolder di dalamnya
  async findDescendantIds(folderId) {
    const result = await query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM folders WHERE id = $1
         UNION ALL
         SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
       )
       SELECT id FROM tree WHERE id <> $1`,
      [folderId]
    );
    return result.rows.map(r => r.id);
  }
}
