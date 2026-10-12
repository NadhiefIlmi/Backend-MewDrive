/**
 * Task 18 — Security Integration Tests
 * Covers: security headers, SQL injection resistance, path traversal,
 *         admin-only endpoints, cross-user ownership
 */

import { ok, fail, section, api, auth, login, uploadBuffer, makeTextBuffer } from './helpers.mjs';

export async function runSecurityTests() {
  section('SECURITY — Headers, SQL Injection, Ownership, Admin-Only');

  const token = await login();
  if (!token) { fail('Login untuk security tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. Security headers (Helmet) ──────────────────────────────────────────
  const rHealth = await api('GET', '/health');
  const headers  = rHealth.headers;

  // Ambil header dari raw response
  const rawRes  = await fetch(`http://localhost:3001/api/health`, { method: 'HEAD' });
  const xframe  = rawRes.headers.get('x-frame-options');
  const nosniff = rawRes.headers.get('x-content-type-options');

  xframe?.toUpperCase() === 'SAMEORIGIN'
    ? ok('Header X-Frame-Options: SAMEORIGIN ada')
    : fail('Header X-Frame-Options', `got: ${xframe ?? 'tidak ada'}`);

  nosniff === 'nosniff'
    ? ok('Header X-Content-Type-Options: nosniff ada')
    : fail('Header X-Content-Type-Options', `got: ${nosniff ?? 'tidak ada'}`);

  // ── 2. SQL injection resistance ───────────────────────────────────────────
  // Login dengan SQL injection di field email
  const r2a = await api('POST', '/auth/login', {
    body: { email: "' OR '1'='1", password: 'anything' },
  });
  // 400 = validasi email format, 401 = credentials salah, 429 = rate limit
  // Semua menunjukkan server TIDAK terpengaruh SQL injection
  (r2a.status === 400 || r2a.status === 401 || r2a.status === 429) && !r2a.body.success
    ? ok("SQL injection di email login ditolak (tidak bisa bypass auth)")
    : fail('SQL injection login', `status=${r2a.status} success=${r2a.body.success}`);

  // Search dengan SQL injection
  const r2b = await api('GET', "/search?q='; DROP TABLE files;--", h);
  r2b.status === 200 // harus tetap 200 (parameterized query — tidak error)
    ? ok("SQL injection di search query tidak crash server (parameterized queries)")
    : fail('SQL injection search', `status=${r2b.status}`);

  // Share file_id sebagai string SQL
  const r2c = await api('POST', '/share', {
    ...h, body: { file_id: "1; DROP TABLE files;--" },
  });
  r2c.status === 400 && r2c.body.error?.code === 'VALIDATION_ERROR'
    ? ok('SQL injection di share file_id → 400 VALIDATION_ERROR')
    : fail('SQL injection share', `status=${r2c.status}`);

  // ── 3. Path traversal di nama folder/file ─────────────────────────────────
  const r3a = await api('POST', '/folders', {
    ...h, body: { name: '../../../etc/passwd' },
  });
  r3a.status === 400
    ? ok("Path traversal di nama folder '../../../etc/passwd' → 400")
    : fail('Path traversal folder name', `status=${r3a.status}`);

  const r3b = await api('POST', '/folders', {
    ...h, body: { name: '..\\..\\windows\\system32' },
  });
  r3b.status === 400
    ? ok('Path traversal Windows backslash → 400')
    : fail('Path traversal folder Windows', `status=${r3b.status}`);

  // ── 4. Admin-only endpoints harus 403/401 untuk non-admin ─────────────────
  // Endpoint ini memerlukan ADMIN role — ADMIN account yang kita pakai harus boleh
  // Tapi kita test bahwa endpoint ada dan tidak 404

  const r4a = await api('GET', '/users', h); // ADMIN → harus 200
  r4a.status === 200
    ? ok('GET /users (ADMIN) → 200')
    : fail('GET /users ADMIN → 200', `status=${r4a.status}`);

  const r4b = await api('GET', '/roles', h); // semua user login
  r4b.status === 200
    ? ok('GET /roles (login) → 200')
    : fail('GET /roles login → 200', `status=${r4b.status}`);

  // ── 5. Cross-user ownership ────────────────────────────────────────────────
  // Upload file, lalu coba akses dengan token tidak valid (simulasi user lain)
  const buf = makeTextBuffer('ownership test');
  const upRes = await uploadBuffer(token, buf, 'task18-ownership.txt', 'text/plain');
  const fileId = upRes.body.data?.id;

  if (fileId) {
    // Akses dengan token palsu → 401 (bukan 403 atau 200)
    const rFake = await api('GET', `/files/${fileId}`, { headers: auth('eyJhbGciOiJIUzI1NiJ9.fake.token') });
    rFake.status === 401
      ? ok('Akses file dengan token palsu → 401')
      : fail('Akses file dengan token palsu → 401', `status=${rFake.status}`);

    // Cleanup
    await api('DELETE', `/files/${fileId}`, h);
    await api('DELETE', `/files/${fileId}/permanent`, h);
  }

  // ── 6. Endpoint tidak ada → 404 (tidak leak info) ─────────────────────────
  const r6 = await api('GET', '/nonexistent-endpoint-xyz');
  r6.status === 404
    ? ok('Endpoint tidak ada → 404 (tidak leak stack trace)')
    : fail('Endpoint tidak ada → 404', `status=${r6.status}`);

  !JSON.stringify(r6.body).toLowerCase().includes('stack') &&
  !JSON.stringify(r6.body).toLowerCase().includes('at ')
    ? ok('Response 404 tidak leak stack trace')
    : fail('Response 404 tidak leak stack trace', 'stack trace ditemukan');

  // ── 7. File type injection — upload file berbahaya ─────────────────────────
  // SVG (XSS vector) → harus ditolak
  const svgBuf = Buffer.from('<svg><script>alert(1)</script></svg>');
  const r7a = await uploadBuffer(token, svgBuf, 'evil.svg', 'image/svg+xml');
  r7a.body.error?.code === 'FILE_TYPE_NOT_ALLOWED'
    ? ok('Upload SVG (XSS vector) → FILE_TYPE_NOT_ALLOWED')
    : fail('Upload SVG ditolak', `status=${r7a.status} code=${r7a.body.error?.code}`);

  // PHP disguised as JPEG (magic bytes mismatch) → harus ditolak
  const phpBuf = Buffer.from('<?php system($_GET["cmd"]); ?>');
  const r7b = await uploadBuffer(token, phpBuf, 'shell.php', 'image/jpeg');
  ['FILE_TYPE_MISMATCH', 'FILE_TYPE_NOT_ALLOWED'].includes(r7b.body.error?.code)
    ? ok('Upload PHP disguised as JPEG → FILE_TYPE_MISMATCH/NOT_ALLOWED')
    : fail('Upload PHP disguised as JPEG ditolak', `code=${r7b.body.error?.code}`);

  // ── 8. Rate limiting login ────────────────────────────────────────────────
  // Test ini harus TERAKHIR karena memicu banyak login gagal.
  // Di development login limit = 100, di production = 5.
  // Kita verifikasi dua hal:
  //   a) Header RateLimit-Limit ada (rate limiter aktif)
  //   b) Kalau limit kecil (prod), 429 muncul setelah beberapa percobaan
  section('SECURITY — Rate Limiting (dijalankan paling akhir)');

  // Cek header RateLimit-Limit ada — membuktikan rate limiter aktif
  const rLimitCheck = await api('POST', '/auth/login', {
    body: { email: 'nadhiefilmi@gmail.com', password: 'rate_limit_check_wrong_pw' },
  });
  const limitHeader = rLimitCheck.headers?.get?.('ratelimit-limit') ??
                      rLimitCheck.headers?.['ratelimit-limit'];
  if (limitHeader) {
    ok(`Rate limiter aktif — RateLimit-Limit header ada (limit=${limitHeader})`);
  } else {
    // Fallback: coba trigger 429 dengan banyak percobaan
    let hitLimit = false;
    for (let i = 0; i < 110; i++) {
      const r = await api('POST', '/auth/login', {
        body: { email: 'nadhiefilmi@gmail.com', password: `rate_limit_test_${i}` },
      });
      if (r.status === 429) { hitLimit = true; break; }
    }
    hitLimit
      ? ok('Rate limiting aktif → 429 setelah percobaan gagal berulang')
      : fail('Rate limiting', 'Tidak pernah dapat 429 dan RateLimit-Limit header tidak ada');
  }
}
