/**
 * Production Readiness Checklist — Task 19
 *
 * Jalankan sebelum deploy ke production untuk verifikasi semua config sudah benar.
 * Script ini TIDAK merubah apapun — hanya membaca dan memverifikasi.
 *
 * Jalankan: node scripts/check-production.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
let warned = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, hint) {
  console.log(`  ❌  ${label}`);
  if (hint) console.log(`       → ${hint}`);
  failed++;
}

function warn(label, hint) {
  console.log(`  ⚠️   ${label}`);
  if (hint) console.log(`       → ${hint}`);
  warned++;
}

function section(title) {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

// ─── Load env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '../.env');
const envExists = fs.existsSync(envPath);

// Parse .env manually (tanpa dotenv supaya tidak contaminate process.env test)
const envVars = {};
if (envExists) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    envVars[key] = val;
  }
}

const env = envVars;
const isProduction = env.NODE_ENV === 'production';

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║       Task 19 — Production Readiness Checklist               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Environment: ${env.NODE_ENV ?? 'not set'}`);
console.log(`  Checking: ${envPath}\n`);

// ─── 1. Environment file ──────────────────────────────────────────────────────
section('1. Environment File');

envExists
  ? ok('.env file ada')
  : fail('.env file tidak ada', 'Salin dari .env.example dan isi semua nilai');

const examplePath = path.join(__dirname, '../.env.example');
fs.existsSync(examplePath)
  ? ok('.env.example ada (template tersedia)')
  : warn('.env.example tidak ada');

const prodExamplePath = path.join(__dirname, '../.env.production.example');
fs.existsSync(prodExamplePath)
  ? ok('.env.production.example ada')
  : warn('.env.production.example tidak ada');

// ─── 2. NODE_ENV ──────────────────────────────────────────────────────────────
section('2. NODE_ENV');

if (env.NODE_ENV === 'production') {
  ok('NODE_ENV=production');
} else if (env.NODE_ENV === 'development') {
  warn('NODE_ENV=development', 'Set ke "production" sebelum deploy');
} else {
  fail('NODE_ENV tidak di-set', 'Set ke "production"');
}

// ─── 3. JWT Secret ────────────────────────────────────────────────────────────
section('3. JWT Secret');

if (!env.JWT_SECRET) {
  fail('JWT_SECRET tidak di-set', 'Wajib di-set');
} else {
  const defaultSecrets = ['your-super-secret', 'secret', 'changeme', 'change-this'];
  const usesDefault = defaultSecrets.some(d => env.JWT_SECRET.toLowerCase().includes(d));

  if (usesDefault) {
    fail('JWT_SECRET masih pakai nilai default', 'Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  } else if (env.JWT_SECRET.length < 32) {
    warn('JWT_SECRET terlalu pendek', 'Minimal 32 karakter, disarankan 64+');
  } else {
    ok(`JWT_SECRET sudah di-set (${env.JWT_SECRET.length} karakter)`);
  }
}

env.JWT_EXPIRES_IN
  ? ok(`JWT_EXPIRES_IN: ${env.JWT_EXPIRES_IN}`)
  : warn('JWT_EXPIRES_IN tidak di-set', 'Default 7d');

// ─── 4. Database ──────────────────────────────────────────────────────────────
section('4. Database');

if (!env.DATABASE_URL) {
  fail('DATABASE_URL tidak di-set', 'Wajib di-set');
} else {
  ok('DATABASE_URL di-set');
  // Cek tidak pakai localhost di production
  if (isProduction && (env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1'))) {
    warn('DATABASE_URL mengarah ke localhost', 'Pastikan ini benar untuk setup server lokal');
  }
  // Cek ada password
  try {
    const url = new URL(env.DATABASE_URL);
    if (!url.password) {
      warn('Database URL tidak punya password', 'Pastikan database dilindungi password di production');
    } else {
      ok('Database URL punya credentials');
    }
  } catch {
    warn('DATABASE_URL format tidak bisa di-parse', 'Verifikasi format: postgres://user:pass@host:port/db');
  }
}

// ─── 5. CORS / Frontend URL ───────────────────────────────────────────────────
section('5. CORS & Frontend URL');

if (!env.FRONTEND_URL) {
  isProduction
    ? fail('FRONTEND_URL tidak di-set', 'Wajib di production untuk CORS')
    : warn('FRONTEND_URL tidak di-set', 'Diperlukan di production');
} else if (env.FRONTEND_URL.includes('localhost')) {
  isProduction
    ? fail('FRONTEND_URL masih localhost', 'Ganti ke domain production')
    : ok(`FRONTEND_URL: ${env.FRONTEND_URL} (development OK)`);
} else {
  ok(`FRONTEND_URL: ${env.FRONTEND_URL}`);
}

// ─── 6. Security settings ─────────────────────────────────────────────────────
section('6. Security Settings');

const bcryptRounds = parseInt(env.BCRYPT_ROUNDS ?? '10');
if (bcryptRounds < 10) {
  fail(`BCRYPT_ROUNDS=${bcryptRounds}`, 'Minimal 10, disarankan 12 di production');
} else if (bcryptRounds >= 12) {
  ok(`BCRYPT_ROUNDS=${bcryptRounds} (production-grade)`);
} else {
  ok(`BCRYPT_ROUNDS=${bcryptRounds} (OK, tapi 12 lebih baik di production)`);
}

const generalLimit = parseInt(env.GENERAL_RATE_LIMIT_MAX ?? '100');
if (isProduction && generalLimit > 200) {
  fail(`GENERAL_RATE_LIMIT_MAX=${generalLimit}`, 'Terlalu tinggi untuk production — hapus atau set ke 100');
} else if (!env.GENERAL_RATE_LIMIT_MAX || generalLimit <= 200) {
  ok(`General rate limit: ${generalLimit} req/menit`);
} else {
  ok(`General rate limit: ${generalLimit} req/menit`);
}

// ─── 7. Storage path ──────────────────────────────────────────────────────────
section('7. Storage');

const storagePath = env.LOCAL_STORAGE_PATH ?? './storage/files';
ok(`Storage path: ${storagePath}`);

if (isProduction && storagePath.startsWith('./')) {
  warn('Storage path relatif', 'Di production gunakan path absolut: /var/mydrive/storage');
}

const resolvedStorage = path.resolve(path.join(__dirname, '..'), storagePath);
if (fs.existsSync(resolvedStorage)) {
  ok(`Storage directory ada: ${resolvedStorage}`);
} else {
  warn(`Storage directory belum ada: ${resolvedStorage}`, `Buat dengan: mkdir -p ${resolvedStorage}`);
}

// ─── 8. .gitignore ────────────────────────────────────────────────────────────
section('8. .gitignore');

const gitignorePath = path.join(__dirname, '../../.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  gitignore.includes('.env')
    ? ok('.env ada di .gitignore')
    : fail('.env TIDAK ada di .gitignore', 'BAHAYA: credentials bisa masuk ke git!');
  gitignore.includes('node_modules')
    ? ok('node_modules ada di .gitignore')
    : warn('node_modules tidak ada di .gitignore');
  gitignore.includes('storage/')
    ? ok('storage/ ada di .gitignore')
    : warn('storage/ tidak ada di .gitignore', 'File upload tidak perlu di-commit');
} else {
  fail('.gitignore tidak ditemukan');
}

// ─── 9. Files & dependencies ──────────────────────────────────────────────────
section('9. Required Files');

const requiredFiles = [
  ['server.js', 'Entry point server'],
  ['src/app.js', 'Express app'],
  ['src/config/env.js', 'Config'],
  ['src/database/migrate.js', 'Migration runner'],
  ['src/database/seed.js', 'Seed runner'],
];

for (const [file, label] of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file);
  fs.existsSync(fullPath)
    ? ok(`${label}: ${file}`)
    : fail(`${label} tidak ada: ${file}`);
}

// node_modules ada
const nodeModulesPath = path.join(__dirname, '../node_modules');
fs.existsSync(nodeModulesPath)
  ? ok('node_modules terinstall')
  : fail('node_modules tidak ada', 'Jalankan: npm install');

// ─── 10. Health check endpoint ────────────────────────────────────────────────
section('10. Health Check');

// Verifikasi kode health check ada di routes/index.js
const routesPath = path.join(__dirname, '../src/routes/index.js');
if (fs.existsSync(routesPath)) {
  const routesSrc = fs.readFileSync(routesPath, 'utf8');
  routesSrc.includes('/health') && routesSrc.includes('database')
    ? ok('Health check endpoint ada (dengan DB check)')
    : routesSrc.includes('/health')
    ? warn('Health check ada tapi tidak cek database')
    : fail('Health check endpoint tidak ditemukan');
}

// ─── Final summary ────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                       HASIL CHECKLIST                        ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  ✅  Passed  : ${String(passed).padStart(3)}                                        ║`);
console.log(`║  ⚠️   Warnings: ${String(warned).padStart(3)}                                        ║`);
console.log(`║  ❌  Failed  : ${String(failed).padStart(3)}                                        ║`);
console.log('╚══════════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n  ❌  Ada masalah yang harus diperbaiki sebelum deploy ke production.\n');
  process.exit(1);
} else if (warned > 0) {
  console.log('\n  ⚠️   Ada peringatan — review sebelum deploy ke production.\n');
  process.exit(0);
} else {
  console.log('\n  🎉  Semua checklist passed! Backend siap untuk production.\n');
  process.exit(0);
}
