export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      name        VARCHAR(255) NOT NULL,
      color       VARCHAR(50)  DEFAULT 'default',
      is_starred  BOOLEAN      DEFAULT false,
      is_trashed  BOOLEAN      DEFAULT false,
      trashed_at  TIMESTAMP,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_folders_user_id    ON folders(user_id);
    CREATE INDEX IF NOT EXISTS idx_folders_parent_id  ON folders(parent_id);
    CREATE INDEX IF NOT EXISTS idx_folders_user_trash ON folders(user_id, is_trashed);

    -- Nama unik per user dalam folder yang sama (root = parent_id IS NULL)
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_folders_name_in_parent
      ON folders(user_id, parent_id, name)
      WHERE parent_id IS NOT NULL AND is_trashed = false;

    CREATE UNIQUE INDEX IF NOT EXISTS uidx_folders_name_in_root
      ON folders(user_id, name)
      WHERE parent_id IS NULL AND is_trashed = false;
  `);
  console.log('✓ Created folders table');
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS folders CASCADE;');
  console.log('✓ Dropped folders table');
};
