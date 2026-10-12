/**
 * Task 18 — Share Link Integration Tests
 * Covers: create, list, toggle, delete, public access, expiry
 */

import { ok, fail, section, api, auth, login, uploadBuffer, makeTextBuffer } from './helpers.mjs';

export async function runShareTests() {
  section('SHARE LINKS — Create, Toggle, Delete, Public Access');

  const token = await login();
  if (!token) { fail('Login untuk share tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // Upload file untuk di-share
  const buf = makeTextBuffer('Share test file content — Task 18');
  const upRes = await uploadBuffer(token, buf, 'task18-share-test.txt', 'text/plain');
  if (!upRes.body.success) {
    fail('Upload file untuk share test', JSON.stringify(upRes.body));
    return;
  }
  const fileId = upRes.body.data.id;

  // ── 1. Buat share link ─────────────────────────────────────────────────────
  const r1 = await api('POST', '/share', { ...h, body: { file_id: fileId } });
  if (r1.status === 201 && r1.body.success && r1.body.data?.token) {
    ok('POST /share → 201 + token');
  } else {
    fail('POST /share → 201', JSON.stringify(r1.body));
    return;
  }
  const shareId    = r1.body.data.id;
  const shareToken = r1.body.data.token;

  // Buat link dengan expiry masa depan → OK
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const r1b = await api('POST', '/share', {
    ...h, body: { file_id: fileId, expires_at: futureDate },
  });
  r1b.status === 201
    ? ok('POST /share dengan expires_at masa depan → 201')
    : fail('POST /share expires_at masa depan', `status=${r1b.status}`);
  const shareId2 = r1b.body.data?.id;

  // Buat link dengan expiry masa lalu → 400
  const r1c = await api('POST', '/share', {
    ...h, body: { file_id: fileId, expires_at: '2020-01-01T00:00:00Z' },
  });
  r1c.status === 400 && r1c.body.error?.code === 'VALIDATION_ERROR'
    ? ok('POST /share expires_at masa lalu → 400 VALIDATION_ERROR')
    : fail('POST /share expires_at masa lalu → 400', `status=${r1c.status} code=${r1c.body.error?.code}`);

  // Buat link untuk file tidak ada → 404
  const r1d = await api('POST', '/share', { ...h, body: { file_id: 99999999 } });
  r1d.status === 404
    ? ok('POST /share file tidak ada → 404')
    : fail('POST /share file tidak ada → 404', `status=${r1d.status}`);

  // ── 2. List share links ────────────────────────────────────────────────────
  const r2 = await api('GET', '/share', h);
  if (r2.status === 200 && Array.isArray(r2.body.data)) {
    ok(`GET /share → 200, ${r2.body.data.length} link`);
  } else {
    fail('GET /share → 200', JSON.stringify(r2.body));
  }

  // ── 3. Akses publik (tanpa auth) ───────────────────────────────────────────
  // GET /share/public/:token — metadata
  const r3 = await api('GET', `/share/public/${shareToken}`);
  if (r3.status === 200 && r3.body.success) {
    ok('GET /share/public/:token → 200 (tanpa auth)');
    r3.body.data?.name
      ? ok('Public share mengembalikan nama file')
      : fail('Public share nama file', JSON.stringify(r3.body.data));
  } else {
    fail('GET /share/public/:token → 200', `status=${r3.status}`);
  }

  // GET /share/public/:token/preview
  const r3b = await api('GET', `/share/public/${shareToken}/preview`);
  r3b.status === 200
    ? ok('GET /share/public/:token/preview → 200 (tanpa auth)')
    : fail('GET /share/public/:token/preview → 200', `status=${r3b.status}`);

  // GET /share/public/:token/download
  const r3c = await api('GET', `/share/public/${shareToken}/download`);
  r3c.status === 200
    ? ok('GET /share/public/:token/download → 200 (tanpa auth)')
    : fail('GET /share/public/:token/download → 200', `status=${r3c.status}`);

  // Token tidak valid → 404
  const r3d = await api('GET', '/share/public/tokeninvalidxyz123456789');
  r3d.status === 404
    ? ok('GET /share/public/:invalid_token → 404')
    : fail('GET /share/public/:invalid_token → 404', `status=${r3d.status}`);

  // ── 4. Toggle aktif/nonaktif ───────────────────────────────────────────────
  // Backend minta body { is_active: boolean }
  const r4 = await api('PATCH', `/share/${shareId}/toggle`, {
    ...h, body: { is_active: false },
  });
  if (r4.status === 200) {
    ok('PATCH /share/:id/toggle → 200');
    const isNowInactive = r4.body.data?.is_active === false;
    isNowInactive
      ? ok('Toggle → link menjadi nonaktif')
      : fail('Toggle → nonaktif', `is_active=${r4.body.data?.is_active}`);
  } else {
    fail('PATCH /share/:id/toggle → 200', `status=${r4.status} body=${JSON.stringify(r4.body)}`);
  }

  // Akses link yang nonaktif → error
  const r4b = await api('GET', `/share/public/${shareToken}`);
  r4b.status !== 200
    ? ok('Akses link nonaktif → ditolak')
    : fail('Akses link nonaktif ditolak', `status=${r4b.status} — masih bisa diakses`);

  // Toggle kembali → aktif
  const r4c = await api('PATCH', `/share/${shareId}/toggle`, {
    ...h, body: { is_active: true },
  });
  r4c.body.data?.is_active === true
    ? ok('Toggle kembali → link aktif lagi')
    : fail('Toggle kembali aktif', `is_active=${r4c.body.data?.is_active}`);

  // ── 5. Ownership — tidak bisa manage link orang lain ──────────────────────
  const rNoAuth = await api('GET', '/share');
  rNoAuth.status === 401
    ? ok('GET /share tanpa auth → 401')
    : fail('GET /share tanpa auth → 401', `status=${rNoAuth.status}`);

  const rDelNoAuth = await api('DELETE', `/share/${shareId}`);
  rDelNoAuth.status === 401
    ? ok('DELETE /share/:id tanpa auth → 401')
    : fail('DELETE /share/:id tanpa auth → 401', `status=${rDelNoAuth.status}`);

  // ── 6. Delete share link ───────────────────────────────────────────────────
  const r6 = await api('DELETE', `/share/${shareId}`, h);
  r6.status === 200
    ? ok('DELETE /share/:id → 200')
    : fail('DELETE /share/:id → 200', `status=${r6.status}`);

  // Akses link yang sudah dihapus → 404
  const r6b = await api('GET', `/share/public/${shareToken}`);
  r6b.status === 404
    ? ok('Akses share link yang sudah dihapus → 404')
    : fail('Akses share link dihapus → 404', `status=${r6b.status}`);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  if (shareId2) await api('DELETE', `/share/${shareId2}`, h);
  await api('DELETE', `/files/${fileId}`, h);
  await api('DELETE', `/files/${fileId}/permanent`, h);
  ok('Cleanup share test selesai');
}
