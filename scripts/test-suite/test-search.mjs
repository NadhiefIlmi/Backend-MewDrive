/**
 * Task 18 — Search Integration Tests
 * Covers: search by keyword, min length, exclude trashed, limit
 */

import { ok, fail, section, api, auth, login, uploadBuffer, makeTextBuffer } from './helpers.mjs';

export async function runSearchTests() {
  section('SEARCH — Keyword, Min Length, Exclusions');

  const token = await login();
  if (!token) { fail('Login untuk search tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  const UNIQUE = `srch${Date.now()}`;

  // Upload file dengan nama unik
  const buf = makeTextBuffer('search test file');
  const upRes = await uploadBuffer(token, buf, `${UNIQUE}-file.txt`, 'text/plain');
  const fileId = upRes.body.data?.id;

  // Buat folder dengan nama unik
  const folderRes = await api('POST', '/folders', { ...h, body: { name: `${UNIQUE}-folder` } });
  const folderId = folderRes.body.data?.id;

  // ── 1. Search dengan keyword → hasil muncul ────────────────────────────────
  // Beri sedikit jeda supaya data terbuat
  await new Promise(r => setTimeout(r, 300));

  const r1 = await api('GET', `/search?q=${UNIQUE}`, h);
  if (r1.status === 200 && r1.body.success) {
    ok('GET /search?q= → 200');
    const filesFound   = r1.body.data?.files   ?? [];
    const foldersFound = r1.body.data?.folders ?? [];
    filesFound.some(f => f.id === fileId)
      ? ok(`File dengan nama "${UNIQUE}" ditemukan di search`)
      : fail(`File ${UNIQUE} ditemukan`, `files found: ${JSON.stringify(filesFound.map(f => f.name))}`);
    foldersFound.some(f => f.id === folderId)
      ? ok(`Folder dengan nama "${UNIQUE}" ditemukan di search`)
      : fail(`Folder ${UNIQUE} ditemukan`, `folders found: ${JSON.stringify(foldersFound.map(f => f.name))}`);
  } else {
    fail('GET /search → 200', `status=${r1.status} body=${JSON.stringify(r1.body)}`);
  }

  // ── 2. Kurang dari 2 karakter → tidak ada hasil ───────────────────────────
  const r2 = await api('GET', '/search?q=a', h);
  if (r2.status === 200) {
    const total = r2.body.data?.total ?? (r2.body.data?.files?.length + r2.body.data?.folders?.length);
    total === 0
      ? ok('Search < 2 karakter → total=0 (tidak diproses)')
      : fail('Search < 2 karakter → total=0', `total=${total}`);
  } else {
    fail('Search < 2 karakter → 200', `status=${r2.status}`);
  }

  // ── 3. Case-insensitive ────────────────────────────────────────────────────
  const UPPER = UNIQUE.toUpperCase();
  const r3 = await api('GET', `/search?q=${UPPER}`, h);
  if (r3.status === 200) {
    const found = [...(r3.body.data?.files ?? []), ...(r3.body.data?.folders ?? [])];
    found.length > 0
      ? ok('Search case-insensitive — huruf besar menemukan nama lowercase')
      : fail('Search case-insensitive', `tidak ada hasil untuk "${UPPER}"`);
  }

  // ── 4. File trashed tidak muncul di search ────────────────────────────────
  if (fileId) {
    await api('DELETE', `/files/${fileId}`, h); // trash

    await new Promise(r => setTimeout(r, 300));
    const r4 = await api('GET', `/search?q=${UNIQUE}`, h);
    const trashedInResults = (r4.body.data?.files ?? []).some(f => f.id === fileId);
    !trashedInResults
      ? ok('File trashed tidak muncul di hasil search')
      : fail('File trashed tidak muncul', `file ${fileId} masih ada di search results`);

    await api('DELETE', `/files/${fileId}/permanent`, h);
  }

  // ── 5. Limit parameter ────────────────────────────────────────────────────
  const r5 = await api('GET', '/search?q=t&limit=3', h);
  if (r5.status === 200) {
    const total = (r5.body.data?.files?.length ?? 0) + (r5.body.data?.folders?.length ?? 0);
    total <= 6 // max 3 per type
      ? ok(`Search ?limit=3 menghormati limit (total results: ${total})`)
      : fail('Search limit', `terlalu banyak hasil: ${total}`);
  }

  // ── 6. Tanpa auth → 401 ───────────────────────────────────────────────────
  const r6 = await api('GET', '/search?q=test');
  r6.status === 401
    ? ok('GET /search tanpa auth → 401')
    : fail('GET /search tanpa auth → 401', `status=${r6.status}`);

  // Cleanup folder
  if (folderId) {
    await api('DELETE', `/folders/${folderId}`, h);
    await api('DELETE', `/folders/${folderId}/permanent`, h);
  }
}
