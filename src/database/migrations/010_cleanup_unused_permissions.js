/**
 * Migration 010 — Cleanup unused permissions
 *
 * Removes:
 *  - system_settings  (no feature implemented)
 *  - view_all_files   (admin-only, not needed as separate permission)
 *  - view_shared      (share is public link, no per-user sharing)
 *  - manage_shared    (merged into share_files)
 *
 * Updates:
 *  - share_files description updated to reflect public share link model
 */

export const up = async (client) => {
  // Remove the 4 unused permissions
  // ON DELETE CASCADE in role_permissions and user_permissions handles cleanup automatically
  await client.query(`
    DELETE FROM permissions
    WHERE name IN ('system_settings', 'view_all_files', 'view_shared', 'manage_shared')
  `);

  // Update share_files description to match actual feature
  await client.query(`
    UPDATE permissions
    SET description = 'Create and manage public share links'
    WHERE name = 'share_files'
  `);

  console.log('✓ Removed unused permissions: system_settings, view_all_files, view_shared, manage_shared');
  console.log('✓ Updated share_files description');
};

export const down = async (client) => {
  // Restore the removed permissions
  const removed = [
    { name: 'view_shared',     label: 'View Shared Files',   description: 'Access files shared by others',        category: 'sharing' },
    { name: 'manage_shared',   label: 'Manage Shared Files', description: 'Edit permissions on shared files',     category: 'sharing' },
    { name: 'view_all_files',  label: 'View All Files',      description: 'Access all files in the system',       category: 'admin'   },
    { name: 'system_settings', label: 'System Settings',     description: 'Configure system-wide settings',       category: 'admin'   },
  ];

  for (const p of removed) {
    await client.query(
      `INSERT INTO permissions (name, label, description, category)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [p.name, p.label, p.description, p.category]
    );
  }

  // Restore share_files description
  await client.query(`
    UPDATE permissions
    SET description = 'Share files with other users'
    WHERE name = 'share_files'
  `);

  console.log('✓ Restored removed permissions (rollback)');
};
