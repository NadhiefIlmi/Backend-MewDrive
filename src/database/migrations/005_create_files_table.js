export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS files (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id       INTEGER       REFERENCES folders(id) ON DELETE SET NULL,
      name            VARCHAR(255)  NOT NULL,
      original_name   VARCHAR(255)  NOT NULL,
      mime_type       VARCHAR(100)  NOT NULL,
      extension       VARCHAR(20)   NOT NULL,
      size            BIGINT        NOT NULL DEFAULT 0,
      storage_path    VARCHAR(500)  NOT NULL,
      is_starred      BOOLEAN       DEFAULT false,
      is_trashed      BOOLEAN       DEFAULT false,
      trashed_at      TIMESTAMP,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_user_id      ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_files_folder_id    ON files(folder_id);
    CREATE INDEX IF NOT EXISTS idx_files_user_trash   ON files(user_id, is_trashed);
    CREATE INDEX IF NOT EXISTS idx_files_mime_type    ON files(mime_type);
    CREATE INDEX IF NOT EXISTS idx_files_created_at   ON files(created_at DESC);

    -- Nama unik per user dalam folder yang sama
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_files_name_in_folder
      ON files(user_id, folder_id, name)
      WHERE folder_id IS NOT NULL AND is_trashed = false;

    CREATE UNIQUE INDEX IF NOT EXISTS uidx_files_name_in_root
      ON files(user_id, name)
      WHERE folder_id IS NULL AND is_trashed = false;
  `);
  console.log('✓ Created files table');
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS files CASCADE;');
  console.log('✓ Dropped files table');
};
