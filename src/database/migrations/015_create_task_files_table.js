export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS task_files (
      task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (task_id, file_id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_files_file_id ON task_files(file_id);
  `);
  console.log('✓ Created task_files table');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_task_files_file_id;
    DROP INDEX IF EXISTS idx_task_files_task_id;
    DROP TABLE IF EXISTS task_files;
  `);
  console.log('✓ Dropped task_files table');
};
