import bcrypt from 'bcrypt';
import { config } from '../../config/env.js';

export const seed = async (client) => {
  console.log('Seeding initial data...');

  // Seed roles
  const rolesResult = await client.query(`
    INSERT INTO roles (name) 
    VALUES ('ADMIN'), ('USER')
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name;
  `);
  
  if (rolesResult.rows.length > 0) {
    console.log('✓ Roles seeded:', rolesResult.rows.map(r => r.name).join(', '));
  } else {
    console.log('⊘ Roles already exist');
  }

  // Get ADMIN role id
  const adminRoleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['ADMIN']);
  const adminRoleId = adminRoleResult.rows[0].id;

  // Hash password for admin
  const hashedPassword = await bcrypt.hash('nadhif123', config.security.bcryptRounds);

  // Seed admin user
  const userResult = await client.query(`
    INSERT INTO users (name, email, password_hash, role_id, storage_quota, storage_used, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, name, email;
  `, [
    'Admin',
    'nadhiefilmi@gmail.com',
    hashedPassword,
    adminRoleId,
    107374182400, // 100GB
    0,
    'active'
  ]);

  if (userResult.rows.length > 0) {
    console.log('✓ Admin user created:');
    console.log('  Email:', userResult.rows[0].email);
    console.log('  Password: nadhif123');
  } else {
    console.log('⊘ Admin user already exists');
  }
};
