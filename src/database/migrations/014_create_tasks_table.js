export const up = async (client) => {
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'in_review', 'done');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL        PRIMARY KEY,
      user_id     INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(255)  NOT NULL,
      description TEXT          NOT NULL DEFAULT '',
      priority    task_priority NOT NULL DEFAULT 'medium',
      status      task_status   NOT NULL DEFAULT 'todo',
      due_date    DATE,
      position    INTEGER       NOT NULL DEFAULT 0,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id       ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status   ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_priority ON tasks(user_id, priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(user_id, due_date) WHERE due_date IS NOT NULL;
  `);
  console.log('✓ Created tasks table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_tasks_due_date;
    DROP INDEX IF EXISTS idx_tasks_user_priority;
    DROP INDEX IF EXISTS idx_tasks_user_status;
    DROP INDEX IF EXISTS idx_tasks_user_id;
    DROP TABLE IF EXISTS tasks;
    DROP TYPE IF EXISTS task_status;
    DROP TYPE IF EXISTS task_priority;
  `);
  console.log('✓ Dropped tasks table');
};
