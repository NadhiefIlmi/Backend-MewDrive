/**
 * Task 18 — Integration Test Suite
 *
 * Menjalankan semua integration test untuk backend MyDrive.
 * Menggunakan HTTP langsung ke server — tidak ada mock.
 *
 * Jalankan:
 *   node scripts/test-integration.mjs
 *
 * Syarat:
 *   - Backend harus running: npm run dev (di folder backend)
 *   - Database harus hidup dan migration sudah dijalankan: npm run migrate
 *   - Akun admin harus ada: npm run seed
 */

import { passed, failed, results, resetCounters, printSummary } from './test-suite/helpers.mjs';
import { runAuthTests }     from './test-suite/test-auth.mjs';
import { runFolderTests }   from './test-suite/test-folders.mjs';
import { runFileTests }     from './test-suite/test-files.mjs';
import { runNotesTests }    from './test-suite/test-notes.mjs';
import { runShareTests }    from './test-suite/test-share.mjs';
import { runStorageTests, runPermissionTests } from './test-suite/test-storage.mjs';
import { runSearchTests }   from './test-suite/test-search.mjs';
import { runSecurityTests } from './test-suite/test-security.mjs';
import { runChangePasswordTests } from './test-suite/test-change-password.mjs';

const BASE = process.env.API_URL || 'http://localhost:3001/api';

// ─── Cek backend hidup ────────────────────────────────────────────────────────
async function checkBackend() {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    return body;
  } catch (e) {
    console.error('\n❌  Backend tidak bisa dijangkau di', BASE);
    console.error('    Pastikan backend sudah running: npm run dev\n');
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          Task 18 — Integration Test Suite                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Backend : ${BASE}`);
  console.log(`  Time    : ${new Date().toLocaleString()}`);

  const health = await checkBackend();
  console.log(`  Status  : ${health.data?.status ?? 'ok'}\n`);

  // Semua suite — urutan penting: auth dulu supaya token siap
  const suites = [
    { name: 'Auth',            fn: runAuthTests },
    { name: 'Change Password', fn: runChangePasswordTests },
    { name: 'Folders',         fn: runFolderTests },
    { name: 'Files',           fn: runFileTests },
    { name: 'Notes',           fn: runNotesTests },
    { name: 'Share Links',     fn: runShareTests },
    { name: 'Storage',         fn: runStorageTests },
    { name: 'Permissions',     fn: runPermissionTests },
    { name: 'Search',          fn: runSearchTests },
    { name: 'Security',        fn: runSecurityTests },
  ];

  const suiteResults = [];

  for (const suite of suites) {
    // Simpan counter sebelum suite berjalan
    const beforePassed = passed;
    const beforeFailed = failed;

    try {
      await suite.fn();
    } catch (e) {
      console.error(`\n  ❌  Suite "${suite.name}" crash: ${e.message}`);
      console.error('     ', e.stack?.split('\n')[1] ?? '');
    }

    suiteResults.push({
      name:   suite.name,
      passed: passed - beforePassed,
      failed: failed - beforeFailed,
    });
  }

  // ─── Final summary ────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RINGKASAN HASIL                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  for (const s of suiteResults) {
    const status = s.failed === 0 ? '✅' : '❌';
    const name   = s.name.padEnd(16);
    console.log(`║  ${status}  ${name}  ${String(s.passed).padStart(2)} passed, ${String(s.failed).padStart(2)} failed          ║`);
  }

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL            ${String(passed).padStart(3)} passed, ${String(failed).padStart(3)} failed              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n  Test yang gagal:');
    results
      .filter(r => r.status === '❌')
      .forEach(r => {
        console.log(`  • ${r.name}`);
        if (r.reason) console.log(`    → ${r.reason}`);
      });
    console.log('');
  } else {
    console.log('\n  🎉  Semua integration test PASSED!\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('\n❌  Test runner error:', e.message);
  process.exit(1);
});
