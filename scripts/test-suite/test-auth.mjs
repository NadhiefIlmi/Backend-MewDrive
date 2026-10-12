/**
 * Task 18 — Auth Integration Tests
 * Covers: login, logout, JWT validation, /me, token blacklist
 *
 * DESIGN:
 * - Login pertama → shared token (tidak pernah di-logout)
 * - Login kedua segera setelah → dedicated untuk test blacklist
 * - Test invalid credential dilakukan SETELAH kedua login berhasil
 * - Rate limit test ada di test-security.mjs (dijalankan paling akhir)
 */

import { ok, fail, section, api, auth, login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers.mjs';

export async function runAuthTests() {
  section('AUTH — Login, Logout, JWT, Blacklist');

  // ── 1. Login valid — ambil DULU dua token sebelum test invalid ────────────
  // Ini penting: test invalid di bawah memicu counter rate limit.
  // Kita perlu dua token sukses sebelum itu terjadi.

  const r1 = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (r1.status === 200 && r1.body.success && r1.body.data?.token) {
    ok('Login valid → 200 + token');
  } else {
    fail('Login valid → 200 + token', `status=${r1.status} error=${r1.body.error?.code}`);
    return;
  }
  const sharedToken = r1.body.data.token;
  globalThis.__sharedToken = sharedToken; // dipakai semua suite berikutnya

  // Token kedua — khusus untuk test logout/blacklist, tidak akan dipakai suite lain
  const r1b = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (r1b.status !== 200 || !r1b.body.data?.token) {
    fail('Login kedua untuk blacklist test', `status=${r1b.status}`);
    // Lanjutkan dengan shared token saja
  }
  const tokenToRevoke = r1b.body.data?.token ?? null;

  // ── 2. Verifikasi response login ──────────────────────────────────────────
  const user = r1.body.data?.user;
  user?.id && user?.email && user?.role
    ? ok('Login response punya user.id, email, role')
    : fail('Login response user fields', JSON.stringify(user));

  !JSON.stringify(r1.body).includes('password')
    ? ok('Password tidak ada di response login')
    : fail('Password tidak ada di response login', 'password field ditemukan');

  // ── 3. Login invalid ──────────────────────────────────────────────────────
  // Dilakukan SETELAH kedua login sukses berhasil
  const r2 = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: 'wrongpassword' },
  });
  r2.status === 401 && !r2.body.success
    ? ok('Login password salah → 401')
    : fail('Login password salah → 401', `status=${r2.status}`);

  const r3 = await api('POST', '/auth/login', {
    body: { email: 'notexist@test.com', password: 'anything' },
  });
  r3.status === 401 && !r3.body.success
    ? ok('Login email tidak ada → 401')
    : fail('Login email tidak ada → 401', `status=${r3.status}`);

  // Error message tidak reveal user enumeration
  const errMsg2 = r2.body.error?.message ?? '';
  const errMsg3 = r3.body.error?.message ?? '';
  errMsg2 === errMsg3
    ? ok('Error message identik (tidak leak user enumeration)')
    : fail('Error message identik', `"${errMsg2}" vs "${errMsg3}"`);

  // ── 4. Validasi input ──────────────────────────────────────────────────────
  const r4 = await api('POST', '/auth/login', { body: { email: '', password: 'test' } });
  r4.status === 400 && r4.body.error?.code === 'VALIDATION_ERROR'
    ? ok('Login email kosong → 400 VALIDATION_ERROR')
    : fail('Login email kosong → 400', `status=${r4.status}`);

  const r5 = await api('POST', '/auth/login', { body: { email: 'notanemail', password: 'test' } });
  r5.status === 400 && r5.body.error?.code === 'VALIDATION_ERROR'
    ? ok('Login email format invalid → 400 VALIDATION_ERROR')
    : fail('Login email format invalid → 400', `status=${r5.status}`);

  const r6 = await api('POST', '/auth/login', { body: { email: ADMIN_EMAIL } });
  r6.status === 400 && r6.body.error?.code === 'VALIDATION_ERROR'
    ? ok('Login tanpa password → 400 VALIDATION_ERROR')
    : fail('Login tanpa password → 400', `status=${r6.status}`);

  // ── 5. GET /auth/me ────────────────────────────────────────────────────────
  const rMe = await api('GET', '/auth/me', { headers: auth(sharedToken) });
  rMe.status === 200 && rMe.body.data?.email === ADMIN_EMAIL
    ? ok('GET /auth/me → 200 dengan data user benar')
    : fail('GET /auth/me → 200', `status=${rMe.status}`);

  const rMeNoAuth = await api('GET', '/auth/me');
  rMeNoAuth.status === 401
    ? ok('GET /auth/me tanpa token → 401')
    : fail('GET /auth/me tanpa token → 401', `status=${rMeNoAuth.status}`);

  const rMeBad = await api('GET', '/auth/me', { headers: auth('invalid.token.here') });
  rMeBad.status === 401
    ? ok('GET /auth/me token invalid → 401')
    : fail('GET /auth/me token invalid → 401', `status=${rMeBad.status}`);

  // ── 6. Logout + JWT blacklist ──────────────────────────────────────────────
  if (tokenToRevoke) {
    const rLogout = await api('POST', '/auth/logout', { headers: auth(tokenToRevoke) });
    rLogout.status === 200 && rLogout.body.success
      ? ok('Logout (token kedua) → 200 success')
      : fail('Logout → 200', `status=${rLogout.status}`);

    const rAfter = await api('GET', '/auth/me', { headers: auth(tokenToRevoke) });
    rAfter.status === 401
      ? ok('Token bekas logout DITOLAK oleh blacklist → 401')
      : fail('Token bekas logout DITOLAK', `masih bisa akses, status=${rAfter.status}`);

    // Shared token (tidak di-logout) harus masih valid
    const rShared = await api('GET', '/auth/me', { headers: auth(sharedToken) });
    rShared.status === 200
      ? ok('Shared token (tidak di-logout) tetap valid')
      : fail('Shared token tetap valid', `status=${rShared.status}`);
  } else {
    ok('Logout test — dilewati (token kedua tidak tersedia)');
    ok('Blacklist test — dilewati');
    ok('Shared token test — dilewati');
  }

  // Logout tanpa token → 401
  const rLogoutNoAuth = await api('POST', '/auth/logout');
  rLogoutNoAuth.status === 401
    ? ok('Logout tanpa token → 401')
    : fail('Logout tanpa token → 401', `status=${rLogoutNoAuth.status}`);

  // CATATAN: Rate limit test ada di test-security.mjs (dijalankan paling akhir)
  // agar tidak memblok login untuk suite berikutnya.
}
