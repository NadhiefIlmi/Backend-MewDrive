/**
 * Migration 012 — Add performance indexes
 *
 * Menambah index yang belum ada untuk query-query yang sering dijalankan:
 *
 * files:
 *   - (user_id, is_starred, is_trashed) → findStarredByUser
 *   - (user_id, is_trashed, created_at DESC) → findByUser ORDER BY created_at
 *
 * folders:
 *   - (user_id, is_starred, is_trashed) → findStarredByUser
 *
 * notes:
 *   - (user_id, is_pinned DESC, updated_at DESC) → findByUser ORDER BY
 *
 * share_links:
 *   - (user_id, is_active) → query list link aktif milik user
 *
 * revoked_tokens:
 *   - index expires_at sudah ada dari migration 011
 */

export const up = async (client) => {
  // ── files ──────────────────────────────────────────────────────────────────

  // Starred files query: WHERE user_id=? AND is_starred=true AND is_trashed=false
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_files_starred
      ON files(user_id, is_starred, is_trashed)
      WHERE is_starred = true AND is_trashed = false
  `);

  // List files query: WHERE user_id=? AND is_trashed=false ORDER BY created_at DESC
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_files_user_active_created
      ON files(user_id, created_at DESC)
      WHERE is_trashed = false
  `);

  // Recent files query: ORDER BY GREATEST(last_accessed_at, created_at) DESC
  // Index pada last_accessed_at saja — GREATEST() tidak bisa di-index langsung
  // tapi ini mempercepat filter user_id + is_trashed
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_files_user_active_accessed
      ON files(user_id, last_accessed_at DESC NULLS LAST)
      WHERE is_trashed = false
  `);

  console.log('✓ Added performance indexes on files');

  // ── folders ────────────────────────────────────────────────────────────────

  // Starred folders query: WHERE user_id=? AND is_starred=true AND is_trashed=false
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_folders_starred
      ON folders(user_id, is_starred, is_trashed)
      WHERE is_starred = true AND is_trashed = false
  `);

  // List folders query: WHERE user_id=? AND is_trashed=false ORDER BY name ASC
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_folders_user_active_name
      ON folders(user_id, name ASC)
      WHERE is_trashed = false
  `);

  console.log('✓ Added performance indexes on folders');

  // ── notes ──────────────────────────────────────────────────────────────────

  // List notes: WHERE user_id=? ORDER BY is_pinned DESC, updated_at DESC
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_notes_user_order
      ON notes(user_id, is_pinned DESC, updated_at DESC)
  `);

  console.log('✓ Added performance index on notes');

  // ── share_links ────────────────────────────────────────────────────────────

  // List active links: WHERE user_id=? AND is_active=true
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_share_links_user_active
      ON share_links(user_id, is_active)
      WHERE is_active = true
  `);

  console.log('✓ Added performance index on share_links');
};

export const down = async (client) => {
  await client.query('DROP INDEX IF EXISTS idx_files_starred');
  await client.query('DROP INDEX IF EXISTS idx_files_user_active_created');
  await client.query('DROP INDEX IF EXISTS idx_files_user_active_accessed');
  await client.query('DROP INDEX IF EXISTS idx_folders_starred');
  await client.query('DROP INDEX IF EXISTS idx_folders_user_active_name');
  await client.query('DROP INDEX IF EXISTS idx_notes_user_order');
  await client.query('DROP INDEX IF EXISTS idx_share_links_user_active');
  console.log('✓ Dropped performance indexes (rollback)');
};
