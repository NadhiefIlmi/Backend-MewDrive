export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ Created roles table');
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS roles CASCADE;');
  console.log('✓ Dropped roles table');
};
