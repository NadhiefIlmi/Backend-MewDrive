import { query } from '../config/database.js';

export class TaskRepository {

  // List task user — filter opsional status/priority, pagination
  // Security: user_id selalu dari req.user.id, tidak dari query param
  async findByUser(userId, { status, priority, page = 1, limit = 50 } = {}) {
    const params  = [userId];
    const filters = ['user_id = $1'];
    let   idx     = 2;

    if (status)   { filters.push(`status = $${idx++}`);   params.push(status);   }
    if (priority) { filters.push(`priority = $${idx++}`); params.push(priority); }

    params.push(limit, (page - 1) * limit);

    const result = await query(
      `SELECT id, user_id, title, description, priority, status, due_date,
              position, created_at, updated_at,
              COUNT(*) OVER() AS total_count
       FROM tasks
       WHERE ${filters.join(' AND ')}
       ORDER BY status, position ASC, created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const tasks = result.rows.map(({ total_count, ...r }) => r);

    // Ambil semua files untuk task-task ini dalam 1 query
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const filesResult = await query(
        `SELECT tf.task_id, f.id, f.name, f.original_name, f.mime_type, f.size, f.extension
         FROM task_files tf
         JOIN files f ON f.id = tf.file_id
         WHERE tf.task_id = ANY($1) AND f.is_trashed = false
         ORDER BY tf.created_at ASC`,
        [taskIds]
      );
      // Group files by task_id
      const filesByTask = {};
      for (const row of filesResult.rows) {
        if (!filesByTask[row.task_id]) filesByTask[row.task_id] = [];
        const { task_id, ...file } = row;
        filesByTask[task_id].push(file);
      }
      // Merge ke tiap task
      for (const task of tasks) {
        task.files = filesByTask[task.id] ?? [];
      }
    }

    return { tasks, total };
  }

  // Detail task — ownership diverifikasi di service
  async findById(id) {
    const result = await query(
      `SELECT id, user_id, title, description, priority, status, due_date,
              position, created_at, updated_at
       FROM tasks WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async create(userId, { title, description = '', priority = 'medium', status = 'todo', due_date = null }) {
    // Position = max position di kolom status + 1 (taruh paling bawah kolom)
    const posRes = await query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
       FROM tasks WHERE user_id = $1 AND status = $2`,
      [userId, status]
    );
    const position = posRes.rows[0].next_pos;

    const result = await query(
      `INSERT INTO tasks (user_id, title, description, priority, status, due_date, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, title, description, priority, status, due_date,
                 position, created_at, updated_at`,
      [userId, title, description, priority, status, due_date, position]
    );
    return result.rows[0];
  }

  // Update field yang boleh diubah — whitelist eksplisit, tidak ada wildcard
  async update(id, fields = {}) {
    const allowed = ['title', 'description', 'priority', 'status', 'due_date', 'position'];
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
      `UPDATE tasks SET ${parts.join(', ')}
       WHERE id = $${idx}
       RETURNING id, user_id, title, description, priority, status, due_date,
                 position, created_at, updated_at`,
      params
    );
    return result.rows[0] ?? null;
  }

  async delete(id) {
    const result = await query(
      `DELETE FROM tasks WHERE id = $1 RETURNING id, title`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  // List file yang di-attach ke task
  async findAttachedFiles(taskId) {
    const result = await query(
      `SELECT f.id, f.name, f.original_name, f.mime_type, f.size, f.extension,
              tf.created_at AS attached_at
       FROM task_files tf
       JOIN files f ON f.id = tf.file_id
       WHERE tf.task_id = $1 AND f.is_trashed = false`,
      [taskId]
    );
    return result.rows;
  }

  // Attach file ke task — cek file milik user di service sebelum insert
  async attachFile(taskId, fileId) {
    await query(
      `INSERT INTO task_files (task_id, file_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, fileId]
    );
  }

  async detachFile(taskId, fileId) {
    await query(
      `DELETE FROM task_files WHERE task_id = $1 AND file_id = $2`,
      [taskId, fileId]
    );
  }

  // Untuk report Telegram — ambil summary per user
  async getSummaryByUser(userId) {
    const result = await query(
      `SELECT status, COUNT(*) AS count
       FROM tasks WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );
    return result.rows;
  }

  // Untuk report — task high/critical yang belum done
  async getHighPriorityActive(userId) {
    const result = await query(
      `SELECT id, title, status, due_date
       FROM tasks
       WHERE user_id = $1
         AND priority IN ('high', 'critical')
         AND status != 'done'
       ORDER BY due_date ASC NULLS LAST
       LIMIT 5`,
      [userId]
    );
    return result.rows;
  }

  // Untuk report — task yang due_date-nya dalam 3 hari ke depan
  async getUpcomingDeadlines(userId) {
    const result = await query(
      `SELECT id, title, status, due_date
       FROM tasks
       WHERE user_id = $1
         AND status != 'done'
         AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
       ORDER BY due_date ASC
       LIMIT 5`,
      [userId]
    );
    return result.rows;
  }
}
