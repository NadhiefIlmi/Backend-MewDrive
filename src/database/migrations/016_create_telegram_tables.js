export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_configs (
      user_id       INTEGER   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      bot_token_enc TEXT      NOT NULL,
      iv            TEXT      NOT NULL,
      auth_tag      TEXT      NOT NULL,
      chat_id       BIGINT    NOT NULL,
      is_verified   BOOLEAN   NOT NULL DEFAULT false,
      verified_at   TIMESTAMP,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ Created telegram_configs table');
};

export const down = async (client) => {
  await client.query(`DROP TABLE IF EXISTS telegram_configs;`);
  console.log('✓ Dropped telegram_configs table');
};
