/**
 * Task 18 — Storage & Permissions Integration Tests
 * Covers: storage quota endpoint, quota enforcement on upload, permissions
 */

import { ok, fail, section, api, auth, login, uploadBuffer, makeTextBuffer } from './helpers.mjs';

export async function runStorageTests() {
  section('STORAGE — Quota Endpoint, Enforcement, Cache');

  const token = await login();
  if (!token) { fail('Login untuk storage tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. GET /storage ────────────────────────────────────────────────────────
  const r1 = await api('GET', '/storage', h);
  if (r1.status === 200 && r1.body.success) {
    ok('GET /storage → 200');
  } else {
    fail('GET /storage → 200', `status=${r1.status}`);
    return;
  }

  const data = r1.body.data;

  // Field yang harus ada
  const requiredFields = ['storage_used', 'storage_quota', 'storage_free', 'pct_used', 'breakdown'];
  for (const field of requiredFields) {
    field in data
      ? ok(`GET /storage — field "${field}" ada`)
      : fail(`GET /storage — field "${field}" ada`, 'tidak ada di response');
  }

  // Nilai masuk akal
  typeof data.storage_used === 'number' && data.storage_used >= 0
    ? ok('storage_used adalah angka >= 0')
    : fail('storage_used valid', `dapat: ${data.storage_used}`);

  typeof data.storage_quota === 'number' && data.storage_quota > 0
    ? ok('storage_quota adalah angka > 0')
    : fail('storage_quota valid', `dapat: ${data.storage_quota}`);

  data.storage_free === data.storage_quota - data.storage_used
    ? ok('storage_free = quota - used (konsisten)')
    : fail('storage_free konsisten', `free=${data.storage_free} quota=${data.storage_quota} used=${data.storage_used}`);

  data.pct_used >= 0 && data.pct_used <= 100
    ? ok(`pct_used dalam range 0–100: ${data.pct_used}%`)
    : fail('pct_used range', `dapat: ${data.pct_used}`);

  Array.isArray(data.breakdown)
    ? ok(`breakdown adalah array (${data.breakdown.length} kategori)`)
    : fail('breakdown adalah array', `dapat: ${typeof data.breakdown}`);

  // ── 2. GET /storage tanpa auth ─────────────────────────────────────────────
  const r2 = await api('GET', '/storage');
  r2.status === 401
    ? ok('GET /storage tanpa auth → 401')
    : fail('GET /storage tanpa auth → 401', `status=${r2.status}`);

  // ── 3. storage_used terupdate setelah upload ───────────────────────────────
  const before = Number(r1.body.data.storage_used);

  const buf = makeTextBuffer('Storage test file — Task 18 upload tracking');
  const upRes = await uploadBuffer(token, buf, 'task18-storage-track.txt', 'text/plain');
  if (!upRes.body.success) {
    fail('Upload untuk tracking storage_used', JSON.stringify(upRes.body));
    return;
  }
  const uploadedFileId = upRes.body.data.id;
  const uploadedSize   = Number(upRes.body.data.size);

  // Tunggu cache storage expire (TTL 10 detik) supaya fetch berikutnya
  // mengambil nilai terbaru dari DB, bukan dari cache
  await new Promise(r => setTimeout(r, 11000));

  const r3 = await api('GET', '/storage', h);
  const afterRaw = r3.body.data?.storage_used ?? 0;
  const after = Number(afterRaw);

  if (after > before && after >= before + uploadedSize) {
    ok(`storage_used terupdate setelah upload: ${before} → ${after} (+${after - before} bytes)`);
  } else {
    fail('storage_used terupdate', `before=${before} after=${after} file_size=${uploadedSize}`);
  }

  // ── 4. storage_used berkurang setelah delete permanent ────────────────────
  await api('DELETE', `/files/${uploadedFileId}`, h);           // trash
  await api('DELETE', `/files/${uploadedFileId}/permanent`, h); // permanent

  // Storage cache TTL 10 detik — tunggu cache expired
  await new Promise(r => setTimeout(r, 11000));

  const r4 = await api('GET', '/storage', h);
  const afterDelete = r4.body.data?.storage_used ?? 0;

  if (afterDelete === before) {
    ok(`storage_used kembali ke semula setelah delete permanent: ${afterDelete}`);
  } else {
    fail('storage_used berkurang setelah delete', `expected=${before} got=${afterDelete}`);
  }

  // ── 5. Storage cache bekerja ───────────────────────────────────────────────
  const t0 = Date.now();
  await api('GET', '/storage', h);
  const firstMs = Date.now() - t0;

  const t1 = Date.now();
  const r5b = await api('GET', '/storage', h);
  const secondMs = Date.now() - t1;

  r5b.status === 200
    ? ok('GET /storage ke-2 (cache hit) → 200')
    : fail('GET /storage cache hit', `status=${r5b.status}`);

  console.log(`  ℹ  Storage latency — 1st: ${firstMs}ms, 2nd (cached): ${secondMs}ms`);
}

export async function runPermissionTests() {
  section('PERMISSIONS — Role Defaults, User Override, Admin-Only Endpoints');

  const token = await login();
  if (!token) { fail('Login untuk permission tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. GET /permissions ────────────────────────────────────────────────────
  const r1 = await api('GET', '/permissions', h);
  if (r1.status === 200 && Array.isArray(r1.body.data)) {
    ok(`GET /permissions → 200, ${r1.body.data.length} permission`);
    r1.body.data.length >= 8
      ? ok('Permission list lengkap (≥ 8 permission)')
      : fail('Permission list', `hanya ${r1.body.data.length} permission`);
  } else {
    fail('GET /permissions → 200', JSON.stringify(r1.body));
  }

  // ── 2. GET permission user sendiri ────────────────────────────────────────
  const meRes = await api('GET', '/auth/me', h);
  const userId = meRes.body.data?.id;

  if (userId) {
    const r2 = await api('GET', `/users/${userId}/permissions`, h);
    if (r2.status === 200 && Array.isArray(r2.body.data)) {
      ok(`GET /users/:id/permissions (diri sendiri) → 200, ${r2.body.data.length} permission`);
    } else {
      fail('GET /users/:id/permissions sendiri → 200', `status=${r2.status}`);
    }
  }

  // ── 3. ADMIN bisa GET /users ───────────────────────────────────────────────
  const r3 = await api('GET', '/users', h);
  r3.status === 200
    ? ok('GET /users (ADMIN) → 200')
    : fail('GET /users ADMIN → 200', `status=${r3.status}`);

  // ── 4. Tanpa auth → 401 ───────────────────────────────────────────────────
  const rNoAuth = await api('GET', '/permissions');
  rNoAuth.status === 401
    ? ok('GET /permissions tanpa auth → 401')
    : fail('GET /permissions tanpa auth → 401', `status=${rNoAuth.status}`);

  const rUsersNoAuth = await api('GET', '/users');
  rUsersNoAuth.status === 401
    ? ok('GET /users tanpa auth → 401')
    : fail('GET /users tanpa auth → 401', `status=${rUsersNoAuth.status}`);
}
