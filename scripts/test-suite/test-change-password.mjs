/**
 * Test — Change Own Password
 * Covers: PATCH /api/users/me/password
 *
 * Flow:
 * 1. Buat user test baru (supaya tidak ganggu akun admin/user lain)
 * 2. Login sebagai user test → dapat token
 * 3. Test berbagai skenario ganti password
 * 4. Verifikasi login dengan password baru berhasil
 * 5. Cleanup (hapus user test)
 *
 * Skenario yang diuji:
 * - ✅ Ganti password berhasil (password lama benar)
 * - ❌ Password lama salah → 400 WRONG_CURRENT_PASSWORD
 * - ❌ Password baru terlalu pendek (< 6 karakter) → 400 VALIDATION_ERROR
 * - ❌ Password baru sama dengan password lama → 400 VALIDATION_ERROR
 * - ❌ Tanpa token (unauthenticated) → 401
 * - ❌ Body kosong → 400 VALIDATION_ERROR
 * - ✅ Login dengan password baru berhasil
 * - ❌ Login dengan password lama gagal setelah ganti
 */

import { ok, fail, section, api, auth, login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.mjs';

const TEST_USER_EMAIL    = `test-changepw-${Date.now()}@mewdrive.test`;
const TEST_USER_PASSWORD = 'OldPass123';
const NEW_PASSWORD       = 'NewPass456';

export async function runChangePasswordTests() {
  section('CHANGE PASSWORD — PATCH /api/users/me/password');

  // ── Setup: login sebagai admin untuk buat user test ───────────────────────
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!adminToken) {
    fail('Login admin untuk setup change-password test', 'Gagal login admin');
    return;
  }
  const adminH = { headers: auth(adminToken) };

  // Buat user test baru
  const createRes = await api('POST', '/users', {
    ...adminH,
    body: {
      name: 'Test ChangePassword User',
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      role: 'USER',
    },
  });

  if (!createRes.body.success) {
    fail('Buat user test', `status=${createRes.status} ${JSON.stringify(createRes.body.error)}`);
    return;
  }
  const testUserId = createRes.body.data?.id;
  ok('User test berhasil dibuat');

  // Login sebagai user test
  const loginRes = await api('POST', '/auth/login', {
    body: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  if (!loginRes.body.success || !loginRes.body.data?.token) {
    fail('Login sebagai user test', `status=${loginRes.status}`);
    await cleanup(adminH, testUserId);
    return;
  }
  const userToken = loginRes.body.data.token;
  const userH     = { headers: auth(userToken) };
  ok('Login sebagai user test berhasil');

  // ── 1. Endpoint tanpa auth → 401 ─────────────────────────────────────────
  const rNoAuth = await api('PATCH', '/users/me/password', {
    body: { current_password: TEST_USER_PASSWORD, new_password: NEW_PASSWORD },
  });
  rNoAuth.status === 401
    ? ok('PATCH /users/me/password tanpa token → 401')
    : fail('PATCH /users/me/password tanpa token → 401', `status=${rNoAuth.status}`);

  // ── 2. Body kosong → 400 VALIDATION_ERROR ────────────────────────────────
  const rEmpty = await api('PATCH', '/users/me/password', {
    ...userH,
    body: {},
  });
  rEmpty.status === 400 && rEmpty.body.error?.code === 'VALIDATION_ERROR'
    ? ok('Body kosong → 400 VALIDATION_ERROR')
    : fail('Body kosong → 400 VALIDATION_ERROR', `status=${rEmpty.status} code=${rEmpty.body.error?.code}`);

  // ── 3. current_password kosong → 400 VALIDATION_ERROR ────────────────────
  const rNoCurrent = await api('PATCH', '/users/me/password', {
    ...userH,
    body: { new_password: NEW_PASSWORD },
  });
  rNoCurrent.status === 400 && rNoCurrent.body.error?.code === 'VALIDATION_ERROR'
    ? ok('current_password kosong → 400 VALIDATION_ERROR')
    : fail('current_password kosong → 400', `status=${rNoCurrent.status}`);

  // ── 4. Password baru terlalu pendek (< 6 karakter) → 400 ─────────────────
  const rShort = await api('PATCH', '/users/me/password', {
    ...userH,
    body: { current_password: TEST_USER_PASSWORD, new_password: '123' },
  });
  rShort.status === 400 && rShort.body.error?.code === 'VALIDATION_ERROR'
    ? ok('new_password < 6 karakter → 400 VALIDATION_ERROR')
    : fail('new_password < 6 karakter → 400', `status=${rShort.status} code=${rShort.body.error?.code}`);

  // ── 5. Password baru sama dengan password lama → 400 VALIDATION_ERROR ────
  const rSame = await api('PATCH', '/users/me/password', {
    ...userH,
    body: { current_password: TEST_USER_PASSWORD, new_password: TEST_USER_PASSWORD },
  });
  rSame.status === 400 && rSame.body.error?.code === 'VALIDATION_ERROR'
    ? ok('new_password sama dengan lama → 400 VALIDATION_ERROR')
    : fail('new_password sama dengan lama → 400', `status=${rSame.status} code=${rSame.body.error?.code}`);

  // ── 6. Password lama SALAH → 400 WRONG_CURRENT_PASSWORD ──────────────────
  const rWrong = await api('PATCH', '/users/me/password', {
    ...userH,
    body: { current_password: 'SalahBanget999', new_password: NEW_PASSWORD },
  });
  rWrong.status === 400 && rWrong.body.error?.code === 'WRONG_CURRENT_PASSWORD'
    ? ok('Password lama salah → 400 WRONG_CURRENT_PASSWORD')
    : fail('Password lama salah → 400 WRONG_CURRENT_PASSWORD', `status=${rWrong.status} code=${rWrong.body.error?.code}`);

  // Setelah password lama salah, password lama masih tetap bisa login (tidak berubah)
  const rStillOld = await api('POST', '/auth/login', {
    body: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  rStillOld.status === 200
    ? ok('Setelah attempt gagal, password lama masih valid')
    : fail('Password lama masih valid setelah attempt gagal', `status=${rStillOld.status}`);

  // ── 7. Ganti password BERHASIL ────────────────────────────────────────────
  const rChange = await api('PATCH', '/users/me/password', {
    ...userH,
    body: { current_password: TEST_USER_PASSWORD, new_password: NEW_PASSWORD },
  });
  if (rChange.status === 200 && rChange.body.success) {
    ok('PATCH /users/me/password berhasil → 200 success');
  } else {
    fail('PATCH /users/me/password berhasil → 200', `status=${rChange.status} body=${JSON.stringify(rChange.body)}`);
    await cleanup(adminH, testUserId);
    return;
  }

  // ── 8. Login dengan password BARU berhasil ────────────────────────────────
  const rLoginNew = await api('POST', '/auth/login', {
    body: { email: TEST_USER_EMAIL, password: NEW_PASSWORD },
  });
  rLoginNew.status === 200 && rLoginNew.body.success
    ? ok('Login dengan password BARU berhasil → 200')
    : fail('Login dengan password baru → 200', `status=${rLoginNew.status}`);

  // ── 9. Login dengan password LAMA gagal ───────────────────────────────────
  const rLoginOld = await api('POST', '/auth/login', {
    body: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
  });
  rLoginOld.status === 401
    ? ok('Login dengan password LAMA gagal setelah ganti → 401')
    : fail('Login password lama gagal → 401', `status=${rLoginOld.status}`);

  // ── 10. Token lama MASIH valid (change password tidak invalidate session) ──
  // Ini expected behavior — sesion tetap aktif, hanya password di DB yang berubah
  const rOldToken = await api('GET', '/auth/me', userH);
  rOldToken.status === 200
    ? ok('Token lama tetap valid setelah ganti password (session tidak di-kill)')
    : fail('Token lama tetap valid', `status=${rOldToken.status}`);

  // ── 11. Ganti password lagi dengan password baru sebagai "lama" ───────────
  const NEWER_PASSWORD = 'EvenNewer789';
  const newToken = rLoginNew.body.data?.token;
  if (newToken) {
    const rChange2 = await api('PATCH', '/users/me/password', {
      headers: auth(newToken),
      body: { current_password: NEW_PASSWORD, new_password: NEWER_PASSWORD },
    });
    rChange2.status === 200
      ? ok('Ganti password ke-2 berhasil → 200')
      : fail('Ganti password ke-2', `status=${rChange2.status}`);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await cleanup(adminH, testUserId);
  ok('Cleanup user test selesai');
}

async function cleanup(adminH, userId) {
  if (!userId) return;
  try {
    await api('DELETE', `/users/${userId}`, adminH);
  } catch {
    // Ignore cleanup error
  }
}
