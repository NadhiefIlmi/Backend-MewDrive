import pool from '../config/database.js';
import { seed as seedInitialData } from './seeds/001_seed_initial_data.js';
import { seed as seedPermissions } from './seeds/002_seed_permissions.js';

const seeds = [
  { name: '001_seed_initial_data', run: seedInitialData },
  { name: '002_seed_permissions',  run: seedPermissions },
];

async function runSeeds() {
  const client = await pool.connect();
  
  try {
    console.log('\n🌱 Running database seeds...\n');

    await client.query('BEGIN');

    for (const seed of seeds) {
      console.log(`Running seed: ${seed.name}`);
      await seed.run(client);
      console.log(`✓ Seed completed: ${seed.name}\n`);
    }

    await client.query('COMMIT');

    console.log('✅ All seeds completed successfully!\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds().catch((error) => {
  console.error('Seeding error:', error);
  process.exit(1);
});
