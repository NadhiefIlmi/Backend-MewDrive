import pool from '../config/database.js';
import { up as createRoles }          from './migrations/001_create_roles_table.js';
import { up as createUsers }          from './migrations/002_create_users_table.js';
import { up as createPermissions }    from './migrations/003_create_permissions_tables.js';
import { up as createFolders }        from './migrations/004_create_folders_table.js';
import { up as createFiles }          from './migrations/005_create_files_table.js';
import { up as addFolderIcon }        from './migrations/006_add_icon_to_folders.js';
import { up as addLastAccessed }      from './migrations/007_add_last_accessed_to_files.js';
import { up as createNotes }          from './migrations/008_create_notes_table.js';
import { up as createShareLinks }     from './migrations/009_create_share_links_table.js';
import { up as cleanupPermissions }   from './migrations/010_cleanup_unused_permissions.js';
import { up as createRevokedTokens }  from './migrations/011_create_revoked_tokens_table.js';
import { up as addPerfIndexes }        from './migrations/012_add_performance_indexes.js';

const migrations = [
  { name: '001_create_roles_table',              up: createRoles },
  { name: '002_create_users_table',              up: createUsers },
  { name: '003_create_permissions_tables',       up: createPermissions },
  { name: '004_create_folders_table',            up: createFolders },
  { name: '005_create_files_table',              up: createFiles },
  { name: '006_add_icon_to_folders',             up: addFolderIcon },
  { name: '007_add_last_accessed_to_files',      up: addLastAccessed },
  { name: '008_create_notes_table',              up: createNotes },
  { name: '009_create_share_links_table',        up: createShareLinks },
  { name: '010_cleanup_unused_permissions',      up: cleanupPermissions },
  { name: '011_create_revoked_tokens_table',     up: createRevokedTokens },
  { name: '012_add_performance_indexes',         up: addPerfIndexes },
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔄 Running database migrations...\n');

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get executed migrations
    const result = await client.query('SELECT name FROM migrations');
    const executedMigrations = result.rows.map(row => row.name);

    // Run pending migrations
    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        await client.query('BEGIN');
        try {
          await migration.up(client);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
          console.log(`✓ Migration completed: ${migration.name}\n`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`⊘ Migration already executed: ${migration.name}`);
      }
    }

    console.log('\n✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
