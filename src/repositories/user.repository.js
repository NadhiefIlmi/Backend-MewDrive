import { query } from '../config/database.js';

export class UserRepository {

  // Kolom user yang aman dikembalikan (tidak include password_hash)
  #safeUserCols = `
    u.id, u.name, u.email, r.name AS role_name,
    u.role_id, u.storage_quota, u.storage_used,
    u.status, u.created_at, u.updated_at, u.last_login_at
  `;

  // ─── Existing (Task 1) ───────────────────────────────────────────────────

  // findByEmail: include password_hash untuk keperluan auth (verify bcrypt)
  async findByEmail(email) {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.status,
              u.storage_quota, u.storage_used, u.role_id,
              u.created_at, u.updated_at, u.last_login_at,
              r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0];
  }

  // findById: tidak include password_hash — dipakai untuk auth middleware & /me endpoint
  async findById(id) {
    const result = await query(
      `SELECT ${this.#safeUserCols}
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // findByIdWithPassword: include password_hash — khusus untuk verifikasi password lama
  async findByIdWithPassword(id) {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.status,
              u.storage_quota, u.storage_used, u.role_id,
              u.created_at, u.updated_at, u.last_login_at,
              r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  async updateLastLogin(userId) {
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }

  async create(userData) {
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role_id, storage_quota, storage_used, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role_id, storage_quota, storage_used, status, created_at`,
      [
        userData.name,
        userData.email.toLowerCase(),
        userData.password_hash,
        userData.role_id,
        userData.storage_quota || 107374182400, // 100GB default
        0,
        'active'
      ]
    );
    return result.rows[0];
  }

  async getUserWithoutPassword(userId) {
    const result = await query(
      `SELECT u.id, u.name, u.email, r.name as role,
              u.storage_quota, u.storage_used, u.status,
              u.created_at, u.last_login_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  // ─── Task 2: User Management ─────────────────────────────────────────────

  /**
   * List semua user dengan optional filter status dan role.
   * Supports pagination via limit/offset.
   */
  async findAll({ status, role, search, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`u.status = $${idx++}`);
      params.push(status);
    }

    if (role) {
      conditions.push(`r.name = $${idx++}`);
      params.push(role.toUpperCase());
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await query(
      `SELECT u.id, u.name, u.email, r.name as role,
              u.storage_quota, u.storage_used, u.status,
              u.created_at, u.last_login_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return { users: dataResult.rows, total };
  }

  /**
   * Update data user (name, email, role_id).
   * updated_at harus di-set manual karena tidak ada trigger di DB.
   */
  async update(id, { name, email, role_id }) {
    const fields = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      params.push(email.toLowerCase());
    }
    if (role_id !== undefined) {
      fields.push(`role_id = $${idx++}`);
      params.push(role_id);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, email, role_id, storage_quota, storage_used, status, updated_at`,
      params
    );
    return result.rows[0];
  }

  /**
   * Update password_hash user.
   */
  async updatePassword(id, password_hash) {
    await query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [password_hash, id]
    );
  }

  /**
   * Enable / disable user (toggle status active ↔ inactive).
   */
  async updateStatus(id, status) {
    const result = await query(
      `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, status, updated_at`,
      [status, id]
    );
    return result.rows[0];
  }

  /**
   * Update storage quota user (bytes).
   */
  async updateStorageQuota(id, storage_quota) {
    const result = await query(
      `UPDATE users SET storage_quota = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, storage_quota, storage_used, updated_at`,
      [storage_quota, id]
    );
    return result.rows[0];
  }

  /**
   * Soft delete: hapus user dari DB.
   * Caller wajib cek apakah user adalah satu-satunya ADMIN sebelum memanggil ini.
   */
  async delete(id) {
    const result = await query(
      `DELETE FROM users WHERE id = $1 RETURNING id, name, email`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Hitung jumlah user aktif dengan role tertentu.
   * Dipakai untuk mencegah hapus/nonaktifkan ADMIN terakhir.
   */
  async countByRole(roleName, status = 'active') {
    const result = await query(
      `SELECT COUNT(*) FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = $1 AND u.status = $2`,
      [roleName.toUpperCase(), status]
    );
    return parseInt(result.rows[0].count, 10);
  }

  // ─── Task 2: Role Management ─────────────────────────────────────────────

  async findAllRoles() {
    const result = await query(
      `SELECT id, name, created_at FROM roles ORDER BY id ASC`
    );
    return result.rows;
  }

  async findRoleByName(name) {
    const result = await query(
      `SELECT id, name FROM roles WHERE name = $1`,
      [name.toUpperCase()]
    );
    return result.rows[0];
  }

  // ─── Task 4: storage tracking ────────────────────────────────────────────
  async updateStorageUsed(userId, newUsedBytes) {
    await query(
      `UPDATE users SET storage_used = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newUsedBytes, userId]
    );
  }
}
