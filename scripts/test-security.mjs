/**
 * Security Test Script — Task 15
 *
 * Jalankan: node scripts/test-security.mjs
 * Syarat  : backend harus running di http://localhost:3001
 *
 * Script ini mensimulasikan serangan nyata ke backend dan
 * memverifikasi semua security yang dipasang di Task 15 berjalan benar.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE      = 'http://localhost:3001/api';
const BASE_HOST = 'localhost';
const BASE_PORT = 3001;

// ─── Credentials ─────────────────────────────────────────────────────────────
const EMAIL    = 'nadhiefilmi@gmail.com';
const PASSWORD = 'nadhif123';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function ok(name) {
  passed++;
  results.push({ name, status: '✅' });
  console.log(`  ✅  ${name}`);
}

function fail(name, reason) {
  failed++;
  results.push({ name, status: '❌', reason });
  console.log(`  ❌  ${name}`);
  console.log(`       → ${reason}`);
}

async function json(res) {
  try { return await res.json(); } catch { return {}; }
}

async function login(email = EMAIL, password = PASSWORD) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await json(res);
  return body?.data?.token ?? null;
}

async function logout(token) {
  const res = await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return await json(res);
}

// Upload file dengan buffer — multipart/form-data via node:http (tidak pakai fetch untuk upload)
function uploadBuffer(token, buffer, filename, mimeType) {
  return new Promise((resolve) => {
    const boundary = `----TestBoundary${Date.now()}`;
    const CRLF = '\r\n';

    // Build multipart body
    const partHeader = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      '',
      '',
    ].join(CRLF);

    const partFooter = `${CRLF}--${boundary}--${CRLF}`;

    const headerBuf = Buffer.from(partHeader);
    const footerBuf = Buffer.from(partFooter);
    const bodyBuf   = Buffer.concat([headerBuf, buffer, footerBuf]);

    const options = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/files/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: {} });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, body: { success: false, error: { code: 'REQUEST_ERROR', message: err.message } } });
    });

    req.write(bodyBuf);
    req.end();
  });
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🔐  Task 15 — Security Test Suite');
  console.log('    Backend:', BASE);
  console.log('    Time   :', new Date().toLocaleString());

  // ── Cek backend hidup ──────────────────────────────────────────────────────
  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) throw new Error('not ok');
  } catch {
    console.error('\n❌  Backend tidak bisa dijangkau di', BASE);
    console.error('    Pastikan backend sudah running: npm run dev\n');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('1 · JWT Blacklist — Logout harus revoke token');
  // ═══════════════════════════════════════════════════════════════════════════

  // Login untuk dapat token
  const tokenForLogout = await login();
  if (!tokenForLogout) {
    fail('Login untuk test logout', 'Gagal login — cek kredensial di script');
  } else {
    // Token valid sebelum logout
    const me1 = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenForLogout}` },
    });
    const body1 = await json(me1);
    if (body1.success) {
      ok('Token valid sebelum logout');
    } else {
      fail('Token valid sebelum logout', `Harusnya berhasil, dapat: ${JSON.stringify(body1)}`);
    }

    // Logout
    const logoutRes = await logout(tokenForLogout);
    if (logoutRes.success) {
      ok('Logout berhasil');
    } else {
      fail('Logout berhasil', `Harusnya success:true, dapat: ${JSON.stringify(logoutRes)}`);
    }

    // 🔴 SERANGAN: pakai token lama setelah logout — harus ditolak
    const me2 = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenForLogout}` },
    });
    const body2 = await json(me2);
    if (!body2.success && body2.error?.code === 'UNAUTHORIZED') {
      ok('🔴 Token lama setelah logout DITOLAK (blacklist bekerja)');
    } else {
      fail('🔴 Token lama setelah logout DITOLAK', `Harusnya UNAUTHORIZED, dapat: ${JSON.stringify(body2)}`);
    }

    // Token baru setelah login ulang — harus bisa dipakai
    const tokenNew = await login();
    if (tokenNew) {
      const me3 = await fetch(`${BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenNew}` },
      });
      const body3 = await json(me3);
      if (body3.success) {
        ok('Token baru setelah login ulang bekerja normal');
      } else {
        fail('Token baru setelah login ulang', `Dapat: ${JSON.stringify(body3)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('2 · File Upload Security — Magic Bytes & Allowlist');
  // ═══════════════════════════════════════════════════════════════════════════

  const token = await login();
  if (!token) {
    fail('Login untuk test upload', 'Gagal login');
  } else {

    // File PNG valid (magic bytes: 89 50 4E 47)
    const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const r1 = await uploadBuffer(token, validPng, 'test.png', 'image/png');
    if (r1.body.success) {
      ok('Upload PNG valid berhasil');
    } else {
      fail('Upload PNG valid berhasil', JSON.stringify(r1.body.error));
    }

    // File JPEG valid (magic bytes: FF D8 FF)
    const validJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const r2 = await uploadBuffer(token, validJpeg, 'test.jpg', 'image/jpeg');
    if (r2.body.success) {
      ok('Upload JPEG valid berhasil');
    } else {
      fail('Upload JPEG valid berhasil', JSON.stringify(r2.body.error));
    }

    // PDF valid (magic bytes: 25 50 44 46 = %PDF)
    const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
    const r3 = await uploadBuffer(token, validPdf, 'test.pdf', 'application/pdf');
    if (r3.body.success) {
      ok('Upload PDF valid berhasil');
    } else {
      fail('Upload PDF valid berhasil', JSON.stringify(r3.body.error));
    }

    // 🔴 SVG — harus ditolak (dihapus dari allowlist)
    const svgContent = Buffer.from('<svg><script>alert(1)</script></svg>');
    const r4 = await uploadBuffer(token, svgContent, 'evil.svg', 'image/svg+xml');
    if (!r4.body.success && r4.body.error?.code === 'FILE_TYPE_NOT_ALLOWED') {
      ok('🔴 Upload SVG DITOLAK (dihapus dari allowlist)');
    } else {
      fail('🔴 Upload SVG DITOLAK', `Harusnya FILE_TYPE_NOT_ALLOWED, dapat: ${JSON.stringify(r4.body)}`);
    }

    // 🔴 HTML — harus ditolak
    const htmlContent = Buffer.from('<html><script>document.cookie</script></html>');
    const r5 = await uploadBuffer(token, htmlContent, 'evil.html', 'text/html');
    if (!r5.body.success && r5.body.error?.code === 'FILE_TYPE_NOT_ALLOWED') {
      ok('🔴 Upload HTML DITOLAK (dihapus dari allowlist)');
    } else {
      fail('🔴 Upload HTML DITOLAK', `Harusnya FILE_TYPE_NOT_ALLOWED, dapat: ${JSON.stringify(r5.body)}`);
    }

    // 🔴 PHP file dengan Content-Type image/jpeg (MIME spoofing)
    // File PHP tidak punya magic bytes JPEG → magic bytes check harus tolak
    const phpContent = Buffer.from('<?php system($_GET["cmd"]); ?>');
    const r6 = await uploadBuffer(token, phpContent, 'shell.php', 'image/jpeg');
    if (!r6.body.success && (r6.body.error?.code === 'FILE_TYPE_MISMATCH' || r6.body.error?.code === 'FILE_TYPE_NOT_ALLOWED')) {
      ok('🔴 Upload PHP disguised as JPEG DITOLAK (magic bytes check)');
    } else {
      fail('🔴 Upload PHP disguised as JPEG DITOLAK', `Harusnya FILE_TYPE_MISMATCH, dapat: ${JSON.stringify(r6.body)}`);
    }

    // 🔴 EXE file dengan Content-Type application/pdf (MIME spoofing)
    // Header MZ (Windows executable)
    const exeContent = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
    const r7 = await uploadBuffer(token, exeContent, 'malware.exe', 'application/pdf');
    if (!r7.body.success && (r7.body.error?.code === 'FILE_TYPE_MISMATCH' || r7.body.error?.code === 'FILE_TYPE_NOT_ALLOWED')) {
      ok('🔴 Upload EXE disguised as PDF DITOLAK (magic bytes check)');
    } else {
      fail('🔴 Upload EXE disguised as PDF DITOLAK', `Harusnya FILE_TYPE_MISMATCH, dapat: ${JSON.stringify(r7.body)}`);
    }

    // 🔴 Audio MP3 — harus ditolak (dihapus dari allowlist)
    const mp3Content = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
    const r8 = await uploadBuffer(token, mp3Content, 'test.mp3', 'audio/mpeg');
    if (!r8.body.success && r8.body.error?.code === 'FILE_TYPE_NOT_ALLOWED') {
      ok('🔴 Upload Audio MP3 DITOLAK (dihapus dari allowlist)');
    } else {
      fail('🔴 Upload Audio MP3 DITOLAK', `Harusnya FILE_TYPE_NOT_ALLOWED, dapat: ${JSON.stringify(r8.body)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('3 · Input Validation');
  // ═══════════════════════════════════════════════════════════════════════════

  const tokenV = await login();

  // 🔴 Folder nama kosong
  const f1 = await fetch(`${BASE}/folders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  const b1 = await json(f1);
  if (!b1.success && b1.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Folder nama kosong DITOLAK');
  } else {
    fail('🔴 Folder nama kosong DITOLAK', `Dapat: ${JSON.stringify(b1)}`);
  }

  // 🔴 Folder nama dengan karakter path traversal
  const f2 = await fetch(`${BASE}/folders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '../../../etc/passwd' }),
  });
  const b2 = await json(f2);
  if (!b2.success && b2.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Folder nama path traversal DITOLAK');
  } else {
    fail('🔴 Folder nama path traversal DITOLAK', `Dapat: ${JSON.stringify(b2)}`);
  }

  // 🔴 Folder nama > 255 karakter
  const longName = 'a'.repeat(256);
  const f3 = await fetch(`${BASE}/folders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: longName }),
  });
  const b3 = await json(f3);
  if (!b3.success && b3.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Folder nama > 255 karakter DITOLAK');
  } else {
    fail('🔴 Folder nama > 255 karakter DITOLAK', `Dapat: ${JSON.stringify(b3)}`);
  }

  // 🔴 Note warna tidak valid
  const n1 = await fetch(`${BASE}/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', color: 'bg-hacker-red' }),
  });
  const bn1 = await json(n1);
  if (!bn1.success && bn1.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Note warna tidak valid DITOLAK');
  } else {
    fail('🔴 Note warna tidak valid DITOLAK', `Dapat: ${JSON.stringify(bn1)}`);
  }

  // 🔴 Share link expires masa lalu
  const s1 = await fetch(`${BASE}/share`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: 1, expires_at: '2020-01-01T00:00:00Z' }),
  });
  const bs1 = await json(s1);
  if (!bs1.success && bs1.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Share link expires masa lalu DITOLAK');
  } else {
    fail('🔴 Share link expires masa lalu DITOLAK', `Dapat: ${JSON.stringify(bs1)}`);
  }

  // 🔴 Share link file_id string (SQL injection attempt)
  const s2 = await fetch(`${BASE}/share`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenV}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: "1; DROP TABLE files;--" }),
  });
  const bs2 = await json(s2);
  if (!bs2.success && bs2.error?.code === 'VALIDATION_ERROR') {
    ok('🔴 Share link file_id injection string DITOLAK');
  } else {
    fail('🔴 Share link file_id injection string DITOLAK', `Dapat: ${JSON.stringify(bs2)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('4 · Rate Limiting');
  // ═══════════════════════════════════════════════════════════════════════════

  // Login rate limit — 5 gagal → ke-6 harus 429
  // Catatan: test ini menggunakan password salah, tidak merusak akun
  let hitLimit = false;
  for (let i = 1; i <= 7; i++) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: 'wrongpassword_test' }),
    });
    if (res.status === 429) {
      hitLimit = true;
      break;
    }
  }
  if (hitLimit) {
    ok('🔴 Login rate limit aktif (429 setelah beberapa percobaan gagal)');
  } else {
    fail('🔴 Login rate limit aktif', 'Tidak pernah dapat 429 setelah 7 percobaan gagal');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('5 · Security Headers');
  // ═══════════════════════════════════════════════════════════════════════════

  const headRes = await fetch(`${BASE}/health`, { method: 'HEAD' });

  // X-Frame-Options: SAMEORIGIN
  const xframe = headRes.headers.get('x-frame-options');
  if (xframe && xframe.toUpperCase() === 'SAMEORIGIN') {
    ok('X-Frame-Options: SAMEORIGIN ada');
  } else {
    fail('X-Frame-Options: SAMEORIGIN', `Dapat header: ${xframe ?? 'tidak ada'}`);
  }

  // X-Content-Type-Options: nosniff (dari Helmet)
  const nosniff = headRes.headers.get('x-content-type-options');
  if (nosniff === 'nosniff') {
    ok('X-Content-Type-Options: nosniff ada');
  } else {
    fail('X-Content-Type-Options: nosniff', `Dapat: ${nosniff ?? 'tidak ada'}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('6 · Auth — Request Tanpa Token Ditolak');
  // ═══════════════════════════════════════════════════════════════════════════

  const endpoints = [
    { method: 'GET',  path: '/auth/me' },
    { method: 'GET',  path: '/files' },
    { method: 'GET',  path: '/folders' },
    { method: 'GET',  path: '/notes' },
    { method: 'GET',  path: '/storage' },
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE}${ep.path}`, { method: ep.method });
    const body = await json(res);
    if (res.status === 401 && !body.success) {
      ok(`Unauthenticated ${ep.method} ${ep.path} → 401`);
    } else {
      fail(`Unauthenticated ${ep.method} ${ep.path} → 401`, `Dapat status ${res.status}`);
    }
  }

  // ─── Ringkasan ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  HASIL`);
  console.log('═'.repeat(60));
  console.log(`  ✅  Passed : ${passed}`);
  console.log(`  ❌  Failed : ${failed}`);
  console.log(`  Total  : ${passed + failed}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n  Test yang gagal:');
    results
      .filter(r => r.status === '❌')
      .forEach(r => console.log(`  • ${r.name}\n    → ${r.reason}`));
  } else {
    console.log('\n  🎉  Semua security test PASSED! Backend aman.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n❌  Script error:', err.message);
  process.exit(1);
});
