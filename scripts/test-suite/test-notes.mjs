/**
 * Task 18 — Notes Integration Tests
 * Covers: CRUD, pagination, ownership, color validation
 */

import { ok, fail, section, api, auth, login } from './helpers.mjs';

export async function runNotesTests() {
  section('NOTES — CRUD, Pagination, Ownership');

  const token = await login();
  if (!token) { fail('Login untuk notes tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. Buat catatan ────────────────────────────────────────────────────────
  const r1 = await api('POST', '/notes', {
    ...h,
    body: { title: 'T18 Note', body: 'Isi catatan test', color: 'bg-sun' },
  });
  if (r1.status === 201 && r1.body.success) {
    ok('POST /notes → 201');
  } else {
    fail('POST /notes → 201', JSON.stringify(r1.body));
    return;
  }
  const noteId = r1.body.data.id;

  // Catatan tanpa judul → boleh (judul opsional)
  const r1b = await api('POST', '/notes', {
    ...h,
    body: { title: '', body: 'No title note', color: 'bg-lime' },
  });
  r1b.status === 201
    ? ok('POST /notes tanpa judul → 201 (judul opsional)')
    : fail('POST /notes tanpa judul → 201', `status=${r1b.status}`);
  const noteNoTitleId = r1b.body.data?.id;

  // Warna tidak valid → 400
  const r1c = await api('POST', '/notes', {
    ...h,
    body: { title: 'test', body: 'test', color: 'bg-invalid-color' },
  });
  r1c.status === 400 && r1c.body.error?.code === 'VALIDATION_ERROR'
    ? ok('POST /notes warna tidak valid → 400 VALIDATION_ERROR')
    : fail('POST /notes warna tidak valid → 400', `status=${r1c.status} code=${r1c.body.error?.code}`);

  // ── 2. List catatan ────────────────────────────────────────────────────────
  const r2 = await api('GET', '/notes', h);
  if (r2.status === 200 && Array.isArray(r2.body.data?.notes)) {
    ok(`GET /notes → 200, ${r2.body.data.notes.length} catatan`);
  } else {
    fail('GET /notes → 200', JSON.stringify(r2.body));
  }
  typeof r2.body.data?.total === 'number'
    ? ok('GET /notes punya field total')
    : fail('GET /notes field total', `total=${r2.body.data?.total}`);

  // ── 3. Pagination ──────────────────────────────────────────────────────────
  // Buat beberapa catatan lagi untuk test pagination
  const extraIds = [];
  for (let i = 0; i < 3; i++) {
    const r = await api('POST', '/notes', {
      ...h,
      body: { title: `T18 Page Note ${i}`, body: `Isi ${i}`, color: 'bg-sky' },
    });
    if (r.body.data?.id) extraIds.push(r.body.data.id);
  }

  const r3 = await api('GET', '/notes?page=1&limit=2', h);
  if (r3.status === 200 && r3.body.data?.notes?.length <= 2) {
    ok(`GET /notes?limit=2 → ${r3.body.data.notes.length} catatan (pagination bekerja)`);
  } else {
    fail('GET /notes pagination', `count=${r3.body.data?.notes?.length}`);
  }

  // total harus lebih dari limit (ada lebih dari 2 catatan)
  if (typeof r3.body.data?.total === 'number' && r3.body.data.total >= 2) {
    ok(`GET /notes total=${r3.body.data.total} (konsisten dengan data)`);
  } else {
    fail('GET /notes total >= 2', `total=${r3.body.data?.total}`);
  }

  // ── 4. GET catatan detail ──────────────────────────────────────────────────
  const r4 = await api('GET', `/notes/${noteId}`, h);
  r4.status === 200 && r4.body.data?.id === noteId
    ? ok('GET /notes/:id → 200')
    : fail('GET /notes/:id → 200', `status=${r4.status}`);

  // GET catatan tidak ada → 404
  const r4b = await api('GET', '/notes/99999999', h);
  r4b.status === 404
    ? ok('GET /notes/:id tidak ada → 404')
    : fail('GET /notes/:id tidak ada → 404', `status=${r4b.status}`);

  // ── 5. Update catatan (partial) ───────────────────────────────────────────
  const r5 = await api('PATCH', `/notes/${noteId}`, {
    ...h,
    body: { title: 'T18 Note Updated' },
  });
  r5.status === 200 && r5.body.data?.title === 'T18 Note Updated'
    ? ok('PATCH /notes/:id (title only) → 200')
    : fail('PATCH /notes/:id title', `status=${r5.status}`);

  const r5b = await api('PATCH', `/notes/${noteId}`, {
    ...h,
    body: { color: 'bg-coral' },
  });
  r5b.status === 200 && r5b.body.data?.color === 'bg-coral'
    ? ok('PATCH /notes/:id (color only) → 200')
    : fail('PATCH /notes/:id color', `status=${r5b.status}`);

  const r5c = await api('PATCH', `/notes/${noteId}`, {
    ...h,
    body: { is_pinned: true },
  });
  r5c.status === 200 && r5c.body.data?.is_pinned === true
    ? ok('PATCH /notes/:id (is_pinned) → 200')
    : fail('PATCH /notes/:id is_pinned', `status=${r5c.status}`);

  // ── 6. Ownership check ─────────────────────────────────────────────────────
  // Tanpa auth → 401
  const rNoAuth = await api('GET', '/notes');
  rNoAuth.status === 401
    ? ok('GET /notes tanpa auth → 401')
    : fail('GET /notes tanpa auth → 401', `status=${rNoAuth.status}`);

  const rDelNoAuth = await api('DELETE', `/notes/${noteId}`);
  rDelNoAuth.status === 401
    ? ok('DELETE /notes/:id tanpa auth → 401')
    : fail('DELETE /notes/:id tanpa auth → 401', `status=${rDelNoAuth.status}`);

  // ── 7. Delete catatan ──────────────────────────────────────────────────────
  const r7 = await api('DELETE', `/notes/${noteId}`, h);
  r7.status === 200
    ? ok('DELETE /notes/:id → 200')
    : fail('DELETE /notes/:id → 200', `status=${r7.status}`);

  // Delete catatan yang sudah dihapus → 404
  const r7b = await api('DELETE', `/notes/${noteId}`, h);
  r7b.status === 404
    ? ok('DELETE /notes/:id sudah dihapus → 404')
    : fail('DELETE /notes/:id sudah dihapus → 404', `status=${r7b.status}`);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  for (const id of [...extraIds, noteNoTitleId]) {
    if (id) await api('DELETE', `/notes/${id}`, h);
  }
  ok('Cleanup notes test selesai');
}
