// backend/src/database/migrations/018_create_audit_logs_table.js
// Task 14 — Security Hardening: Audit log untuk operasi sensitif

export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL       PRIMARY KEY,
      user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
      action      VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id   INTEGER,
      meta        JSONB,
      ip_address  INET,
      user_agent  TEXT,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  `);
  console.log('✓ Created audit_logs table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_audit_logs_created_at;
    DROP INDEX IF EXISTS idx_audit_logs_action;
    DROP INDEX IF EXISTS idx_audit_logs_user_id;
    DROP TABLE IF EXISTS audit_logs;
  `);
  console.log('✓ Dropped audit_logs table');
};
