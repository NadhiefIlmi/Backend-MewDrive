/**
 * Database Optimization Test Script — Task 16
 *
 * Jalankan: node scripts/test-db-optimization.mjs
 * Syarat  : backend harus running di http://localhost:3001
 *
 * Script ini memverifikasi semua optimasi Task 16 berjalan benar:
 * 1. Bug fix findStarredByUser folder
 * 2. COUNT+SELECT digabung (response punya field total)
 * 3. Index baru ada di database
 * 4. Auto-cleanup token expired
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE = 'http://localhost:3001/api';
const DB_URL = process.env.DATABASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✅  ${name}`);
}

function fail(name, reason) {
  failed++;
  console.log(`  ❌  ${name}`);
  console.log(`       → ${reason}`);
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  try { return { status: res.status, body: await res.json() }; }
  catch { return { status: res.status, body: {} }; }
}

async function login() {
  const r = await apiJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nadhiefilmi@gmail.com', password: 'nadhif123' }),
  });
  return r.body?.data?.token ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🗄️   Task 16 — Database Optimization Test Suite');
  console.log('    Backend:', BASE);
  console.log('    Time   :', new Date().toLocaleString());

  // Cek backend hidup
  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error();
  } catch {
    console.error('\n❌  Backend tidak bisa dijangkau. Jalankan: npm run dev\n');
    process.exit(1);
  }

  // Koneksi langsung ke DB untuk cek indexes
  const pool = new pg.Pool({ connectionString: DB_URL });

  // ═══════════════════════════════════════════════════════════════════════════
  section('1 · Index baru ada di database');
  // ═══════════════════════════════════════════════════════════════════════════

  const expectedIndexes = [
    'idx_files_starred',
    'idx_files_user_active_created',
    'idx_files_user_active_accessed',
    'idx_folders_starred',
    'idx_folders_user_active_name',
    'idx_notes_user_order',
    'idx_share_links_user_active',
  ];

  const result = await pool.query(`
    SELECT indexname FROM pg_indexes
    WHERE indexname = ANY($1::text[])
  `, [expectedIndexes]);

  const foundIndexes = new Set(result.rows.map(r => r.indexname));

  for (const idx of expectedIndexes) {
    if (foundIndexes.has(idx)) {
      ok(`Index ${idx} ada`);
    } else {
      fail(`Index ${idx} ada`, 'Index tidak ditemukan di pg_indexes — jalankan npm run migrate');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('2 · Bug Fix — Starred Folders berfungsi');
  // ═══════════════════════════════════════════════════════════════════════════

  const token = await login();
  if (!token) {
    fail('Login untuk test starred folders', 'Gagal login');
  } else {
    // Ambil folder apapun untuk di-star
    const folders = await apiJson('/folders', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (folders.body?.data?.folders?.length > 0) {
      const folderId = folders.body.data.folders[0].id;

      // Star folder
      const starRes = await apiJson(`/folders/${folderId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: true }),
      });

      if (starRes.body?.data?.is_starred === true) {
        ok('Star folder berhasil');
      } else {
        fail('Star folder berhasil', JSON.stringify(starRes.body));
      }

      // Ambil starred folders — sebelum fix ini selalu error/kosong
      const starredRes = await apiJson('/folders/starred', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (starredRes.body?.success && Array.isArray(starredRes.body?.data?.folders)) {
        const count = starredRes.body.data.folders.length;
        if (count > 0) {
          ok(`GET /folders/starred mengembalikan ${count} folder (bug fix bekerja)`);
        } else {
          fail('GET /folders/starred mengembalikan folder', 'Array kosong — folder yang di-star tidak muncul');
        }
      } else {
        fail('GET /folders/starred berhasil', JSON.stringify(starredRes.body));
      }

      // Unstar kembali (cleanup)
      await apiJson(`/folders/${folderId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: false }),
      });
      ok('Cleanup — folder di-unstar kembali');

    } else {
      // Tidak ada folder — buat dulu
      const createRes = await apiJson('/folders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Folder Starred' }),
      });
      if (createRes.body?.success) {
        ok('Buat folder test untuk starred test');
        const folderId = createRes.body.data.id;

        await apiJson(`/folders/${folderId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_starred: true }),
        });

        const starredRes = await apiJson('/folders/starred', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (starredRes.body?.data?.folders?.length > 0) {
          ok('GET /folders/starred mengembalikan folder (bug fix bekerja)');
        } else {
          fail('GET /folders/starred', JSON.stringify(starredRes.body));
        }

        // Cleanup
        await apiJson(`/folders/${folderId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        fail('Buat folder test', JSON.stringify(createRes.body));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('3 · COUNT+SELECT digabung — response punya field total');
  // ═══════════════════════════════════════════════════════════════════════════

  const t = await login();

  // Files list — harus ada field total
  const filesRes = await apiJson('/files', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (filesRes.body?.success && typeof filesRes.body?.data?.total === 'number') {
    ok(`GET /files — field total ada (${filesRes.body.data.total})`);
  } else {
    fail('GET /files — field total ada', `data: ${JSON.stringify(filesRes.body?.data)}`);
  }

  // Folders list — harus ada field total
  const foldersRes = await apiJson('/folders', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (foldersRes.body?.success && typeof foldersRes.body?.data?.total === 'number') {
    ok(`GET /folders — field total ada (${foldersRes.body.data.total})`);
  } else {
    fail('GET /folders — field total ada', `data: ${JSON.stringify(foldersRes.body?.data)}`);
  }

  // Notes list — harus ada field total
  const notesRes = await apiJson('/notes', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (notesRes.body?.success && typeof notesRes.body?.data?.total === 'number') {
    ok(`GET /notes — field total ada (${notesRes.body.data.total})`);
  } else {
    fail('GET /notes — field total ada', `data: ${JSON.stringify(notesRes.body?.data)}`);
  }

  // Trash files — harus ada field total
  const trashRes = await apiJson('/files/trash', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (trashRes.body?.success && typeof trashRes.body?.data?.total === 'number') {
    ok(`GET /files/trash — field total ada (${trashRes.body.data.total})`);
  } else {
    fail('GET /files/trash — field total ada', `data: ${JSON.stringify(trashRes.body?.data)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('4 · total_count tidak bocor ke response data');
  // ═══════════════════════════════════════════════════════════════════════════

  // Field total_count (raw DB column) tidak boleh ada di item array
  const filesItems = filesRes.body?.data?.files ?? [];
  const hasLeak = filesItems.some(f => 'total_count' in f);
  if (!hasLeak) {
    ok('total_count tidak bocor ke item files (hanya di data.total)');
  } else {
    fail('total_count tidak bocor ke item files', 'Field total_count masih ada di setiap item');
  }

  const foldersItems = foldersRes.body?.data?.folders ?? [];
  const hasFolderLeak = foldersItems.some(f => 'total_count' in f);
  if (!hasFolderLeak) {
    ok('total_count tidak bocor ke item folders');
  } else {
    fail('total_count tidak bocor ke item folders', 'Field total_count masih ada di setiap item');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('5 · Token cleanup — expired tokens dihapus dari DB');
  // ═══════════════════════════════════════════════════════════════════════════

  // Insert token expired langsung ke DB untuk test cleanup
  await pool.query(`
    INSERT INTO revoked_tokens (jti, user_id, expires_at)
    VALUES ('test-expired-jti-cleanup', 1, CURRENT_TIMESTAMP - INTERVAL '1 hour')
    ON CONFLICT (jti) DO NOTHING
  `);

  // Verifikasi token ada sebelum cleanup
  const before = await pool.query(
    `SELECT 1 FROM revoked_tokens WHERE jti = 'test-expired-jti-cleanup'`
  );
  if (before.rowCount > 0) {
    ok('Token expired berhasil diinsert ke DB untuk test');
  } else {
    fail('Token expired insert', 'Tidak bisa insert test token');
  }

  // Panggil cleanup endpoint via API (cleanup jalan di server.js, tidak ada endpoint)
  // Verifikasi langsung via DB setelah memanggil token cleanup melalui import
  const { TokenRepository } = await import('../src/repositories/token.repository.js');
  const tokenRepo = new TokenRepository();
  const deletedCount = await tokenRepo.cleanupExpired();

  if (deletedCount > 0) {
    ok(`Cleanup berhasil hapus ${deletedCount} token expired`);
  } else {
    fail('Cleanup token expired', 'cleanupExpired() return 0 — token tidak terhapus');
  }

  // Verifikasi token sudah tidak ada di DB
  const after = await pool.query(
    `SELECT 1 FROM revoked_tokens WHERE jti = 'test-expired-jti-cleanup'`
  );
  if (after.rowCount === 0) {
    ok('Token expired sudah terhapus dari DB setelah cleanup');
  } else {
    fail('Token expired terhapus', 'Token masih ada di DB setelah cleanup');
  }

  // ─── Ringkasan ──────────────────────────────────────────────────────────────
  await pool.end();

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  HASIL');
  console.log('═'.repeat(60));
  console.log(`  ✅  Passed : ${passed}`);
  console.log(`  ❌  Failed : ${failed}`);
  console.log(`  Total  : ${passed + failed}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n  Test yang gagal:');
  } else {
    console.log('\n  🎉  Semua database optimization test PASSED!\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n❌  Script error:', err.message);
  process.exit(1);
});
