import { query } from '../config/database.js';

export class NotesRepository {
  // List catatan user dengan pagination — COUNT digabung dalam satu query
  async findByUser(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, user_id, title, body, color, is_pinned, created_at, updated_at,
              COUNT(*) OVER() AS total_count
       FROM notes
       WHERE user_id = $1
       ORDER BY is_pinned DESC, updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const notes = result.rows.map(({ total_count, ...r }) => r);
    return { notes, total };
  }

  // Detail catatan (ownership check sudah di service)
  async findById(id) {
    const result = await query(
      `SELECT id, user_id, title, body, color, is_pinned, created_at, updated_at
       FROM notes WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(userId, { title = '', body = '', color = 'bg-sun', is_pinned = false } = {}) {
    const result = await query(
      `INSERT INTO notes (user_id, title, body, color, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, title, body, color, is_pinned, created_at, updated_at`,
      [userId, title, body, color, is_pinned]
    );
    return result.rows[0];
  }

  async update(id, fields = {}) {
    const allowed = ['title', 'body', 'color', 'is_pinned'];
    const parts   = [];
    const params  = [];
    let   idx     = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        parts.push(`${key} = $${idx++}`);
        params.push(fields[key]);
      }
    }

    if (parts.length === 0) return null;

    parts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE notes SET ${parts.join(', ')}
       WHERE id = $${idx}
       RETURNING id, user_id, title, body, color, is_pinned, created_at, updated_at`,
      params
    );
    return result.rows[0] ?? null;
  }

  async delete(id) {
    const result = await query(
      `DELETE FROM notes WHERE id = $1 RETURNING id, title`,
      [id]
    );
    return result.rows[0] ?? null;
  }
}
