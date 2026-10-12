export const up = async (client) => {
  await client.query(`
    ALTER TABLE files
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP;

    CREATE INDEX IF NOT EXISTS idx_files_last_accessed
      ON files(user_id, last_accessed_at DESC NULLS LAST)
      WHERE is_trashed = false;
  `);
  console.log('✓ Added last_accessed_at column to files table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_files_last_accessed;
    ALTER TABLE files DROP COLUMN IF EXISTS last_accessed_at;
  `);
  console.log('✓ Dropped last_accessed_at column from files table');
};
