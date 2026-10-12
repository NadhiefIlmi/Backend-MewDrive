export const up = async (client) => {
  await client.query(`
    ALTER TABLE folders
    ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder';
  `);
  console.log('✓ Added icon column to folders table');
};

export const down = async (client) => {
  await client.query(`
    ALTER TABLE folders DROP COLUMN IF EXISTS icon;
  `);
  console.log('✓ Dropped icon column from folders table');
};
