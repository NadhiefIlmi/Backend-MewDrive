export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title        VARCHAR(255) NOT NULL DEFAULT '',
      body         TEXT         NOT NULL DEFAULT '',
      color        VARCHAR(50)  NOT NULL DEFAULT 'bg-sun',
      is_pinned    BOOLEAN      NOT NULL DEFAULT false,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id    ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(user_id, updated_at DESC);
  `);
  console.log('✓ Created notes table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_notes_updated_at;
    DROP INDEX IF EXISTS idx_notes_user_id;
    DROP TABLE IF EXISTS notes;
  `);
  console.log('✓ Dropped notes table');
};
