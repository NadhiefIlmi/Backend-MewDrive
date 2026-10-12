/**
 * Task 18 — Folder Integration Tests
 * Covers: CRUD, move, circular reference, trash, restore, delete permanent
 */

import { ok, fail, section, api, auth, login } from './helpers.mjs';

export async function runFolderTests() {
  section('FOLDERS — CRUD, Move, Trash, Cascade Delete');

  const token = await login();
  if (!token) { fail('Login untuk folder tests', 'Gagal login'); return; }
  const h = { headers: auth(token) };

  // ── 1. Buat folder root ────────────────────────────────────────────────────
  const r1 = await api('POST', '/folders', { ...h, body: { name: 'T18-Root' } });
  if (r1.status === 201 && r1.body.success) {
    ok('Buat folder root → 201');
  } else {
    fail('Buat folder root → 201', JSON.stringify(r1.body));
    return;
  }
  const rootId = r1.body.data.id;

  // ── 2. Buat subfolder ──────────────────────────────────────────────────────
  const r2 = await api('POST', '/folders', { ...h, body: { name: 'T18-Child', parent_id: rootId } });
  if (r2.status === 201 && r2.body.success) {
    ok('Buat subfolder (parent_id) → 201');
  } else {
    fail('Buat subfolder → 201', JSON.stringify(r2.body));
  }
  const childId = r2.body.data?.id;

  // ── 3. Nama duplikat ditolak ───────────────────────────────────────────────
  const r3 = await api('POST', '/folders', { ...h, body: { name: 'T18-Root' } });
  r3.status === 409
    ? ok('Nama folder duplikat di root → 409')
    : fail('Nama folder duplikat → 409', `status=${r3.status}`);

  // Nama sama di folder berbeda → OK
  const r3b = await api('POST', '/folders', { ...h, body: { name: 'T18-Root', parent_id: rootId } });
  r3b.status === 201
    ? ok('Nama sama di parent berbeda → 201 OK')
    : fail('Nama sama di parent berbeda → 201', `status=${r3b.status}`);
  if (r3b.body.data?.id) {
    await api('DELETE', `/folders/${r3b.body.data.id}/permanent`, h); // cleanup
  }

  // ── 4. GET folder list ─────────────────────────────────────────────────────
  const r4 = await api('GET', '/folders', h);
  if (r4.status === 200 && Array.isArray(r4.body.data?.folders)) {
    ok(`GET /folders → 200, ${r4.body.data.folders.length} folder, ada total field`);
  } else {
    fail('GET /folders → 200', JSON.stringify(r4.body));
  }
  typeof r4.body.data?.total === 'number'
    ? ok('GET /folders response punya field total')
    : fail('GET /folders field total', `total=${r4.body.data?.total}`);

  // GET subfolder via parent_id
  const r4b = await api('GET', `/folders?parent_id=${rootId}`, h);
  if (r4b.status === 200 && r4b.body.data?.folders?.length >= 1) {
    ok(`GET /folders?parent_id=${rootId} → subfolder muncul`);
  } else {
    fail('GET /folders?parent_id', `count=${r4b.body.data?.folders?.length}`);
  }

  // ── 5. GET folder detail ───────────────────────────────────────────────────
  const r5 = await api('GET', `/folders/${rootId}`, h);
  r5.status === 200 && r5.body.data?.id === rootId
    ? ok('GET /folders/:id → 200')
    : fail('GET /folders/:id → 200', `status=${r5.status}`);

  // GET folder tidak ada → 404
  const r5b = await api('GET', '/folders/99999999', h);
  r5b.status === 404
    ? ok('GET /folders/:id tidak ada → 404')
    : fail('GET /folders/:id tidak ada → 404', `status=${r5b.status}`);

  // ── 6. PATCH folder — rename + star ───────────────────────────────────────
  const r6 = await api('PATCH', `/folders/${rootId}`, { ...h, body: { name: 'T18-Root-Renamed' } });
  r6.status === 200 && r6.body.data?.name === 'T18-Root-Renamed'
    ? ok('PATCH /folders/:id rename → 200')
    : fail('PATCH rename', `status=${r6.status}`);

  const r6b = await api('PATCH', `/folders/${rootId}`, { ...h, body: { is_starred: true } });
  r6b.status === 200 && r6b.body.data?.is_starred === true
    ? ok('PATCH /folders/:id star → 200')
    : fail('PATCH star', `status=${r6b.status}`);

  // Unstar untuk cleanup
  await api('PATCH', `/folders/${rootId}`, { ...h, body: { is_starred: false } });

  // ── 7. GET starred folders ─────────────────────────────────────────────────
  await api('PATCH', `/folders/${rootId}`, { ...h, body: { is_starred: true } });
  const r7 = await api('GET', '/folders/starred', h);
  if (r7.status === 200 && Array.isArray(r7.body.data?.folders)) {
    ok(`GET /folders/starred → 200, ${r7.body.data.folders.length} folder`);
  } else {
    fail('GET /folders/starred → 200', JSON.stringify(r7.body));
  }
  await api('PATCH', `/folders/${rootId}`, { ...h, body: { is_starred: false } });

  // ── 8. Move folder ─────────────────────────────────────────────────────────
  // Buat folder tujuan
  const rDest = await api('POST', '/folders', { ...h, body: { name: 'T18-Dest' } });
  const destId = rDest.body.data?.id;

  if (childId && destId) {
    const r8 = await api('PATCH', `/folders/${childId}/move`, {
      ...h, body: { target_parent_id: destId },
    });
    r8.status === 200
      ? ok('PATCH /folders/:id/move → 200')
      : fail('PATCH /folders/:id/move → 200', `status=${r8.status} ${JSON.stringify(r8.body)}`);

    // Move kembali ke root (null)
    await api('PATCH', `/folders/${childId}/move`, { ...h, body: { target_parent_id: null } });

    // Move folder ke diri sendiri → error
    const r8b = await api('PATCH', `/folders/${rootId}/move`, {
      ...h, body: { target_parent_id: rootId },
    });
    r8b.status === 400
      ? ok('Move folder ke diri sendiri → 400')
      : fail('Move folder ke diri sendiri → 400', `status=${r8b.status}`);

    // Move folder ke descendant-nya (circular) → error
    // Buat hierarki baru: circParent → circChild, lalu coba pindah circParent ke circChild
    const rcP = await api('POST', '/folders', { ...h, body: { name: 'T18-Circ-Parent' } });
    const circParentId = rcP.body.data?.id;
    if (circParentId) {
      const rcC = await api('POST', '/folders', {
        ...h, body: { name: 'T18-Circ-Child', parent_id: circParentId },
      });
      const circChildId = rcC.body.data?.id;
      if (circChildId) {
        const r8c = await api('PATCH', `/folders/${circParentId}/move`, {
          ...h, body: { target_parent_id: circChildId },
        });
        r8c.status === 400
          ? ok('Move circular reference → 400')
          : fail('Move circular reference → 400', `status=${r8c.status}`);
        // cleanup
        await api('DELETE', `/folders/${circChildId}/permanent`, h);
      }
      await api('DELETE', `/folders/${circParentId}/permanent`, h);
    }

    // Cleanup dest
    await api('DELETE', `/folders/${destId}/permanent`, h);
  }

  // ── 9. Trash & restore ────────────────────────────────────────────────────
  // Buat folder baru khusus untuk test trash/restore (childId sudah dipindah ke root)
  const rTrashTarget = await api('POST', '/folders', { ...h, body: { name: 'T18-TrashTest' } });
  const trashTargetId = rTrashTarget.body.data?.id;

  if (trashTargetId) {
    const r9 = await api('DELETE', `/folders/${trashTargetId}`, h);
    r9.status === 200
      ? ok('DELETE /folders/:id (trash) → 200')
      : fail('DELETE /folders/:id trash → 200', `status=${r9.status}`);

    // Folder di trash muncul di /folders/trash
    const rTrash = await api('GET', '/folders/trash', h);
    const trashedIds = rTrash.body.data?.folders?.map(f => f.id) ?? [];
    trashedIds.includes(trashTargetId)
      ? ok('Folder trashed muncul di GET /folders/trash')
      : fail('Folder trashed di /folders/trash', `ids=${trashedIds}`);

    // Restore
    const r9b = await api('POST', `/folders/${trashTargetId}/restore`, h);
    r9b.status === 200
      ? ok('POST /folders/:id/restore → 200')
      : fail('POST /folders/:id/restore → 200', `status=${r9b.status}`);

    // Cleanup
    await api('DELETE', `/folders/${trashTargetId}/permanent`, h);
  }

  // ── 10. Ownership check ────────────────────────────────────────────────────
  // Coba akses folder dengan token null/invalid
  const rNoAuth = await api('GET', `/folders/${rootId}`);
  rNoAuth.status === 401
    ? ok('GET folder tanpa auth → 401')
    : fail('GET folder tanpa auth → 401', `status=${rNoAuth.status}`);

  // ── 11. Delete permanent + cascade ────────────────────────────────────────
  // Buat folder dengan child untuk test cascade
  const rParent = await api('POST', '/folders', { ...h, body: { name: 'T18-Cascade-Parent' } });
  const cascadeParentId = rParent.body.data?.id;

  if (cascadeParentId) {
    await api('POST', '/folders', { ...h, body: { name: 'T18-Cascade-Child', parent_id: cascadeParentId } });

    // Trash dulu baru permanent delete
    await api('DELETE', `/folders/${cascadeParentId}`, h);
    const r11 = await api('DELETE', `/folders/${cascadeParentId}/permanent`, h);
    r11.status === 200
      ? ok('DELETE /folders/:id/permanent (cascade) → 200')
      : fail('DELETE /folders/:id/permanent → 200', `status=${r11.status}`);
  }

  // Cleanup root
  await api('DELETE', `/folders/${rootId}`, h);
  const rClean = await api('DELETE', `/folders/${rootId}/permanent`, h);
  rClean.status === 200
    ? ok('Cleanup test folders — permanent delete')
    : fail('Cleanup permanent delete', `status=${rClean.status}`);
}
