export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS share_links (
      id          SERIAL PRIMARY KEY,
      file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       VARCHAR(64) UNIQUE NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      expires_at  TIMESTAMP NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_share_links_token   ON share_links(token);
    CREATE INDEX IF NOT EXISTS idx_share_links_file_id ON share_links(file_id);
    CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);
  `);
  console.log('✓ Created share_links table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_share_links_user_id;
    DROP INDEX IF EXISTS idx_share_links_file_id;
    DROP INDEX IF EXISTS idx_share_links_token;
    DROP TABLE IF EXISTS share_links;
  `);
  console.log('✓ Dropped share_links table');
};
