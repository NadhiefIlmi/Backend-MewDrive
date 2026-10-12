/**
 * Task 18 — File Integration Tests
 * Covers: upload, list, get, rename, star, trash, restore, delete, download, preview, move
 */

import http from 'http';
import { ok, fail, skip, section, api, auth, login,
         uploadBuffer, makeTextBuffer, makePdfBuffer, makePngBuffer,
         BASE_HOST, BASE_PORT } from './helpers.mjs';

// Raw HTTP request untuk cek headers (download/preview)
function rawRequest(method, path, reqHeaders) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: BASE_HOST, port: BASE_PORT,
      path: `/api${path}`, method,
      headers: reqHeaders,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks),
      }));
    });
    req.on('error', e => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), error: e.message }));
    req.end();
  });
}

export async function runFileTests() {
  section('FILES — Upload, Download, Preview, Move, Trash');

  const token = await login();
  if (!token) { fail('Login untuk file tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. Upload ──────────────────────────────────────────────────────────────
  const txtBuf = makeTextBuffer('Task 18 integration test — plain text file');
  const r1 = await uploadBuffer(token, txtBuf, 'task18-test.txt', 'text/plain');
  if (r1.status === 201 && r1.body.success) {
    ok('Upload file teks → 201');
  } else {
    fail('Upload file teks → 201', JSON.stringify(r1.body));
    return;
  }
  const fileId = r1.body.data.id;

  // Upload PNG
  const pngBuf = makePngBuffer();
  const r1b = await uploadBuffer(token, pngBuf, 'task18-test.png', 'image/png');
  r1b.status === 201
    ? ok('Upload PNG → 201')
    : fail('Upload PNG → 201', JSON.stringify(r1b.body));
  const pngFileId = r1b.body.data?.id;

  // Upload PDF
  const pdfBuf = makePdfBuffer();
  const r1c = await uploadBuffer(token, pdfBuf, 'task18-test.pdf', 'application/pdf');
  r1c.status === 201
    ? ok('Upload PDF → 201')
    : fail('Upload PDF → 201', JSON.stringify(r1c.body));
  const pdfFileId = r1c.body.data?.id;

  // Upload ke folder yang tidak ada → 404
  const r1d = await uploadBuffer(token, txtBuf, 'test.txt', 'text/plain', 99999999);
  r1d.status === 404
    ? ok('Upload ke folder tidak ada → 404')
    : fail('Upload ke folder tidak ada → 404', `status=${r1d.status}`);

  // ── 2. Auto-rename duplikat ────────────────────────────────────────────────
  const r2 = await uploadBuffer(token, txtBuf, 'task18-test.txt', 'text/plain');
  if (r2.status === 201 && r2.body.data?.name !== 'task18-test.txt') {
    ok(`Upload duplikat di-rename otomatis → "${r2.body.data?.name}"`);
  } else if (r2.status === 201) {
    fail('Upload duplikat di-rename', `nama masih sama: ${r2.body.data?.name}`);
  } else {
    fail('Upload duplikat handling', `status=${r2.status}`);
  }
  const dupFileId = r2.body.data?.id;

  // ── 3. List files ──────────────────────────────────────────────────────────
  const r3 = await api('GET', '/files', h);
  if (r3.status === 200 && Array.isArray(r3.body.data?.files || r3.body.data?.items)) {
    const items = r3.body.data?.files ?? r3.body.data?.items ?? [];
    ok(`GET /files → 200, ${items.length} file`);
  } else {
    fail('GET /files → 200', JSON.stringify(r3.body));
  }
  typeof (r3.body.data?.total) === 'number'
    ? ok('GET /files punya field total')
    : fail('GET /files field total', `total=${r3.body.data?.total}`);

  // ── 4. GET file detail ─────────────────────────────────────────────────────
  const r4 = await api('GET', `/files/${fileId}`, h);
  r4.status === 200 && r4.body.data?.id === fileId
    ? ok('GET /files/:id → 200')
    : fail('GET /files/:id → 200', `status=${r4.status}`);

  r4.body.data?.storage_path === undefined || !JSON.stringify(r4.body).includes('storage_path')
    ? ok('storage_path tidak bocor ke response')
    : fail('storage_path tidak bocor', 'storage_path ada di response');

  // GET file tidak ada → 404
  const r4b = await api('GET', '/files/99999999', h);
  r4b.status === 404
    ? ok('GET /files/:id tidak ada → 404')
    : fail('GET /files/:id tidak ada → 404', `status=${r4b.status}`);

  // ── 5. Rename file ─────────────────────────────────────────────────────────
  const r5 = await api('PATCH', `/files/${fileId}`, { ...h, body: { name: 'task18-renamed.txt' } });
  r5.status === 200 && r5.body.data?.name === 'task18-renamed.txt'
    ? ok('PATCH /files/:id rename → 200')
    : fail('PATCH rename → 200', `status=${r5.status}`);

  // ── 6. Star / unstar ───────────────────────────────────────────────────────
  const r6 = await api('PATCH', `/files/${fileId}`, { ...h, body: { is_starred: true } });
  r6.status === 200 && r6.body.data?.is_starred === true
    ? ok('PATCH /files/:id star → 200')
    : fail('PATCH star', `status=${r6.status}`);

  const rStarred = await api('GET', '/files/starred', h);
  rStarred.status === 200 && Array.isArray(rStarred.body.data?.files || rStarred.body.data)
    ? ok('GET /files/starred → 200')
    : fail('GET /files/starred → 200', `status=${rStarred.status}`);

  await api('PATCH', `/files/${fileId}`, { ...h, body: { is_starred: false } });

  // ── 7. Recent files ────────────────────────────────────────────────────────
  const rRecent = await api('GET', '/files/recent?limit=10', h);
  rRecent.status === 200 && Array.isArray(rRecent.body.data)
    ? ok('GET /files/recent → 200')
    : fail('GET /files/recent → 200', `status=${rRecent.status}`);

  // ── 8. Download — headers, Range, ETag ────────────────────────────────────
  const dlFull = await rawRequest('GET', `/files/${fileId}/download`, {
    Authorization: `Bearer ${token}`,
  });
  if (dlFull.status === 200) {
    ok('GET /files/:id/download → 200');
    dlFull.headers['accept-ranges'] === 'bytes'
      ? ok('Download: Accept-Ranges: bytes')
      : fail('Download: Accept-Ranges', `got: ${dlFull.headers['accept-ranges']}`);
    dlFull.headers['etag']
      ? ok(`Download: ETag header ada (${dlFull.headers['etag']})`)
      : fail('Download: ETag', 'header tidak ada');
    dlFull.headers['content-disposition']?.includes('attachment')
      ? ok('Download: Content-Disposition: attachment')
      : fail('Download: Content-Disposition attachment', `got: ${dlFull.headers['content-disposition']}`);
  } else {
    fail('GET /files/:id/download → 200', `status=${dlFull.status}`);
  }

  // Range request → 206
  const fileSize = parseInt(dlFull.headers['content-length'] || '0', 10);
  if (fileSize > 0) {
    const rangeEnd = Math.min(9, fileSize - 1);
    const dlRange = await rawRequest('GET', `/files/${fileId}/download`, {
      Authorization: `Bearer ${token}`,
      Range: `bytes=0-${rangeEnd}`,
    });
    dlRange.status === 206
      ? ok(`Download Range bytes=0-${rangeEnd} → 206 Partial Content`)
      : fail('Download Range → 206', `status=${dlRange.status}`);

    if (dlRange.status === 206) {
      dlRange.headers['content-range']?.startsWith('bytes 0-')
        ? ok('Download: Content-Range header benar')
        : fail('Download: Content-Range', `got: ${dlRange.headers['content-range']}`);
    }
  }

  // ETag conditional GET → 304
  if (dlFull.headers['etag']) {
    const dlCond = await rawRequest('GET', `/files/${fileId}/download`, {
      Authorization: `Bearer ${token}`,
      'If-None-Match': dlFull.headers['etag'],
    });
    dlCond.status === 304
      ? ok('Download: If-None-Match (ETag match) → 304 Not Modified')
      : fail('Download: 304 conditional GET', `status=${dlCond.status}`);
  }

  // Invalid Range → 416
  const dlBad = await rawRequest('GET', `/files/${fileId}/download`, {
    Authorization: `Bearer ${token}`,
    Range: 'bytes=99999999-99999998',
  });
  dlBad.status === 416
    ? ok('Download: invalid Range → 416 Range Not Satisfiable')
    : fail('Download: 416', `status=${dlBad.status}`);

  // ── 9. Preview ─────────────────────────────────────────────────────────────
  // Text file → previewable
  const pvText = await rawRequest('GET', `/files/${fileId}/preview`, {
    Authorization: `Bearer ${token}`,
  });
  if (pvText.status === 200) {
    ok('GET /files/:id/preview (text) → 200');
    pvText.headers['content-disposition']?.includes('inline')
      ? ok('Preview: Content-Disposition: inline')
      : fail('Preview: Content-Disposition inline', `got: ${pvText.headers['content-disposition']}`);
    pvText.headers['cache-control']?.includes('max-age')
      ? ok('Preview: Cache-Control ada')
      : fail('Preview: Cache-Control', `got: ${pvText.headers['cache-control']}`);
  } else {
    fail('GET /files/:id/preview (text) → 200', `status=${pvText.status}`);
  }

  // PDF preview
  if (pdfFileId) {
    const pvPdf = await rawRequest('GET', `/files/${pdfFileId}/preview`, {
      Authorization: `Bearer ${token}`,
    });
    pvPdf.status === 200 && pvPdf.headers['content-type'] === 'application/pdf'
      ? ok('GET /files/:id/preview (PDF) → 200 + correct mime')
      : fail('GET /files/:id/preview PDF', `status=${pvPdf.status} ct=${pvPdf.headers['content-type']}`);
  }

  // ── 10. Move file ──────────────────────────────────────────────────────────
  const rFolder = await api('POST', '/folders', { ...h, body: { name: 'T18-MoveTarget' } });
  const moveFolderId = rFolder.body.data?.id;
  if (moveFolderId) {
    const r10 = await api('PATCH', `/files/${fileId}/move`, {
      ...h, body: { target_folder_id: moveFolderId },
    });
    r10.status === 200
      ? ok('PATCH /files/:id/move → 200')
      : fail('PATCH /files/:id/move → 200', `status=${r10.status}`);

    // Move kembali ke root
    await api('PATCH', `/files/${fileId}/move`, { ...h, body: { target_folder_id: null } });
  }

  // ── 11. Trash, restore, delete permanent ──────────────────────────────────
  const r11 = await api('DELETE', `/files/${fileId}`, h);
  r11.status === 200
    ? ok('DELETE /files/:id (trash) → 200')
    : fail('DELETE /files/:id trash → 200', `status=${r11.status}`);

  // File di trash tidak bisa di-preview/download
  const pvTrash = await rawRequest('GET', `/files/${fileId}/preview`, {
    Authorization: `Bearer ${token}`,
  });
  pvTrash.status === 400
    ? ok('Preview file trashed → 400 FILE_TRASHED')
    : fail('Preview file trashed → 400', `status=${pvTrash.status}`);

  // GET /files/trash
  const rTrash = await api('GET', '/files/trash', h);
  const trashedIds = (rTrash.body.data?.files ?? rTrash.body.data?.items ?? []).map(f => f.id);
  trashedIds.includes(fileId)
    ? ok('File trashed muncul di GET /files/trash')
    : fail('File di /files/trash', `ids found: ${trashedIds}`);

  // Restore
  const r11b = await api('POST', `/files/${fileId}/restore`, h);
  r11b.status === 200
    ? ok('POST /files/:id/restore → 200')
    : fail('POST /files/:id/restore → 200', `status=${r11b.status}`);

  // Trash lagi lalu delete permanent
  await api('DELETE', `/files/${fileId}`, h);
  const r11c = await api('DELETE', `/files/${fileId}/permanent`, h);
  r11c.status === 200
    ? ok('DELETE /files/:id/permanent → 200')
    : fail('DELETE /files/:id/permanent → 200', `status=${r11c.status}`);

  // ── 12. Unauthenticated ────────────────────────────────────────────────────
  const rNoAuth = await api('GET', '/files');
  rNoAuth.status === 401
    ? ok('GET /files tanpa auth → 401')
    : fail('GET /files tanpa auth → 401', `status=${rNoAuth.status}`);

  // ── Cleanup sisa file ──────────────────────────────────────────────────────
  for (const id of [pngFileId, pdfFileId, dupFileId]) {
    if (!id) continue;
    await api('DELETE', `/files/${id}`, h);
    await api('DELETE', `/files/${id}/permanent`, h);
  }
  if (moveFolderId) {
    await api('DELETE', `/folders/${moveFolderId}/permanent`, h);
  }
}
