import { query } from '../config/database.js';

export class PermissionRepository {

  // Semua permission yang ada di sistem
  async findAll() {
    const result = await query(
      `SELECT id, name, label, description, category
       FROM permissions
       ORDER BY category, name`
    );
    return result.rows;
  }

  // Default permissions untuk sebuah role
  async findByRole(roleId) {
    const result = await query(
      `SELECT p.id, p.name, p.label, p.description, p.category
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.category, p.name`,
      [roleId]
    );
    return result.rows;
  }

  /**
   * Resolusi permission akhir untuk seorang user:
   * Mulai dari default role, lalu apply override user_permissions.
   * granted=true  → tambahkan
   * granted=false → cabut
   */
  async resolveForUser(userId) {
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.label,
         p.description,
         p.category,
         CASE
           WHEN up.id IS NOT NULL THEN up.granted
           ELSE true
         END AS granted
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN users u ON u.role_id = rp.role_id AND u.id = $1
       LEFT JOIN user_permissions up
         ON up.permission_id = p.id AND up.user_id = $1

       UNION

       -- Permissions yang tidak di role tapi di-grant secara explicit ke user ini
       SELECT
         p.id,
         p.name,
         p.label,
         p.description,
         p.category,
         up.granted
       FROM permissions p
       JOIN user_permissions up ON up.permission_id = p.id AND up.user_id = $1 AND up.granted = true
       WHERE NOT EXISTS (
         SELECT 1 FROM role_permissions rp2
         JOIN users u2 ON u2.role_id = rp2.role_id AND u2.id = $1
         WHERE rp2.permission_id = p.id
       )

       ORDER BY category, name`,
      [userId]
    );
    return result.rows;
  }

  // Raw user_permissions overrides untuk seorang user
  async findUserOverrides(userId) {
    const result = await query(
      `SELECT p.id, p.name, up.granted
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  // Upsert satu permission override untuk user
  async upsertUserPermission(userId, permissionId, granted) {
    await query(
      `INSERT INTO user_permissions (user_id, permission_id, granted, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, permission_id)
       DO UPDATE SET granted = EXCLUDED.granted, updated_at = CURRENT_TIMESTAMP`,
      [userId, permissionId, granted]
    );
  }

  // Hapus semua override user lalu set ulang dari array permissionNames
  async replaceUserPermissions(userId, roleId, permissionNames) {
    // Ambil semua permission id
    const allPerms = await this.findAll();
    const rolePerms = await this.findByRole(roleId);
    const rolePermNames = new Set(rolePerms.map(p => p.name));

    // Hapus semua override lama
    await query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    const granted = new Set(permissionNames);

    for (const perm of allPerms) {
      const inRole    = rolePermNames.has(perm.name);
      const inGranted = granted.has(perm.name);

      if (inRole && !inGranted) {
        // Ada di role tapi user tidak mau → cabut
        await this.upsertUserPermission(userId, perm.id, false);
      } else if (!inRole && inGranted) {
        // Tidak ada di role tapi user mau → tambah
        await this.upsertUserPermission(userId, perm.id, true);
      }
      // Kalau keduanya sama → tidak perlu override
    }
  }

  async findPermissionByName(name) {
    const result = await query(
      'SELECT id, name, label, description, category FROM permissions WHERE name = $1',
      [name]
    );
    return result.rows[0];
  }

  async findPermissionById(id) {
    const result = await query(
      'SELECT id, name FROM permissions WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}
