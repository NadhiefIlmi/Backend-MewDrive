/**
 * Seed: Permissions & Role Defaults
 * Isi tabel permissions dengan semua permission yang tersedia,
 * lalu set default permission untuk role ADMIN dan USER.
 */

export const seed = async (client) => {
  // ─── 1. Insert permissions ──────────────────────────────────────────────
  const permissions = [
    // Files
    { name: 'create_files',   label: 'Create Files',    description: 'Upload and create new files',        category: 'files' },
    { name: 'view_files',     label: 'View Files',      description: 'View and access own files',          category: 'files' },
    { name: 'edit_files',     label: 'Edit Files',      description: 'Modify existing files',              category: 'files' },
    { name: 'delete_files',   label: 'Delete Files',    description: 'Delete own files',                   category: 'files' },
    { name: 'download_files', label: 'Download Files',  description: 'Download files to local device',     category: 'files' },
    // Sharing
    { name: 'share_files',    label: 'Share Files',     description: 'Create and manage public share links', category: 'sharing' },
    // Admin
    { name: 'manage_users',        label: 'Manage Users',        description: 'Create, edit, and delete user accounts', category: 'admin' },
    { name: 'storage_management',  label: 'Storage Management',  description: 'Manage storage quotas and usage',        category: 'admin' },
  ];

  for (const p of permissions) {
    await client.query(
      `INSERT INTO permissions (name, label, description, category)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         category = EXCLUDED.category`,
      [p.name, p.label, p.description, p.category]
    );
  }
  console.log(`  ✓ ${permissions.length} permissions inserted`);

  // ─── 2. Get role IDs ────────────────────────────────────────────────────
  const rolesResult = await client.query('SELECT id, name FROM roles');
  const roleMap = {};
  for (const row of rolesResult.rows) roleMap[row.name] = row.id;

  const permResult = await client.query('SELECT id, name FROM permissions');
  const permMap = {};
  for (const row of permResult.rows) permMap[row.name] = row.id;

  // ─── 3. ADMIN: semua permission ─────────────────────────────────────────
  const adminPermissions = Object.keys(permMap);
  for (const permName of adminPermissions) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleMap['ADMIN'], permMap[permName]]
    );
  }
  console.log(`  ✓ ADMIN: ${adminPermissions.length} permissions assigned`);

  // ─── 4. USER: subset permission ─────────────────────────────────────────
  const userPermissions = [
    'create_files', 'view_files', 'edit_files', 'delete_files',
    'download_files', 'share_files',
  ];
  for (const permName of userPermissions) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleMap['USER'], permMap[permName]]
    );
  }
  console.log(`  ✓ USER: ${userPermissions.length} permissions assigned`);
};
