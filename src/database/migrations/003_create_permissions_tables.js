export const up = async (client) => {
  await client.query(`
    -- Daftar semua permission yang tersedia di sistem
    CREATE TABLE IF NOT EXISTS permissions (
      id     SERIAL PRIMARY KEY,
      name   VARCHAR(100) UNIQUE NOT NULL,   -- e.g. "create_files"
      label  VARCHAR(100) NOT NULL,           -- e.g. "Create Files"
      description TEXT,
      category VARCHAR(50) NOT NULL,          -- "files" | "sharing" | "admin"
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Default permission per role (bisa diubah admin)
    CREATE TABLE IF NOT EXISTS role_permissions (
      id            SERIAL PRIMARY KEY,
      role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role_id, permission_id)
    );

    -- Override permission per user (lebih spesifik dari role default)
    CREATE TABLE IF NOT EXISTS user_permissions (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      granted       BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, permission_id)
    );

    CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
  `);
  console.log('✓ Created permissions, role_permissions, user_permissions tables');
};

export const down = async (client) => {
  await client.query(`
    DROP TABLE IF EXISTS user_permissions CASCADE;
    DROP TABLE IF EXISTS role_permissions CASCADE;
    DROP TABLE IF EXISTS permissions CASCADE;
  `);
  console.log('✓ Dropped permissions tables');
};
