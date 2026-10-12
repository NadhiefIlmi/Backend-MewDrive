/**
 * Test helpers — shared utilities untuk semua test module Task 18.
 */

import http from 'http';

export const BASE      = process.env.API_URL || 'http://localhost:3001/api';
export const BASE_HOST = 'localhost';
export const BASE_PORT = parseInt(process.env.PORT || '3001');

export const ADMIN_EMAIL    = 'nadhiefilmi@gmail.com';
export const ADMIN_PASSWORD = 'nadhif123';

// ─── Counter ──────────────────────────────────────────────────────────────────
export let passed = 0;
export let failed = 0;
export const results = [];

export function resetCounters() {
  passed = 0;
  failed = 0;
  results.length = 0;
}

export function ok(name) {
  passed++;
  results.push({ name, status: '✅' });
  console.log(`  ✅  ${name}`);
}

export function fail(name, reason) {
  failed++;
  results.push({ name, status: '❌', reason });
  console.log(`  ❌  ${name}`);
  if (reason) console.log(`       → ${reason}`);
}

export function skip(name, reason) {
  console.log(`  ⚠️   ${name} — SKIP: ${reason}`);
}

export function section(title) {
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(62));
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export async function api(method, path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const init = { method, headers };
  if (options.body) init.body = JSON.stringify(options.body);
  const res = await fetch(url, init);
  let body;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, headers: res.headers, body };
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function login(email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  // Pakai shared token yang sudah ada untuk hindari login ulang / rate limit
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD && globalThis.__sharedToken) {
    return globalThis.__sharedToken;
  }
  const r = await api('POST', '/auth/login', { body: { email, password } });
  const token = r.body?.data?.token ?? null;
  if (token && email === ADMIN_EMAIL) globalThis.__sharedToken = token;
  return token;
}

// Upload via node:http (fetch tidak support multipart dengan binary data yang reliable)
export function uploadBuffer(token, buffer, filename, mimeType, folderId = null) {
  return new Promise((resolve) => {
    const boundary = `----T18Boundary${Date.now()}`;
    const CRLF = '\r\n';

    let parts = Buffer.alloc(0);

    // file part
    const fileHeader = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      '', '',
    ].join(CRLF);
    parts = Buffer.concat([parts, Buffer.from(fileHeader), buffer, Buffer.from(CRLF)]);

    // folder_id part (optional)
    if (folderId !== null) {
      const folderPart = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="folder_id"`,
        '', String(folderId), '',
      ].join(CRLF);
      parts = Buffer.concat([parts, Buffer.from(folderPart)]);
    }

    const footer = Buffer.from(`--${boundary}--${CRLF}`);
    const body   = Buffer.concat([parts, footer]);

    const req = http.request({
      hostname: BASE_HOST,
      port:     BASE_PORT,
      path:     '/api/files/upload',
      method:   'POST',
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', e => resolve({ status: 0, body: { error: { message: e.message } } }));
    req.write(body);
    req.end();
  });
}

// Buat file test kecil (teks biasa)
export function makeTextBuffer(content = 'Hello Task 18 test file') {
  return Buffer.from(content, 'utf8');
}

// Buat PDF minimal (magic bytes valid)
export function makePdfBuffer() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
}

// Buat PNG minimal (magic bytes valid: 89 50 4E 47 0D 0A 1A 0A)
export function makePngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 px
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth etc
  ]);
}

export function printSummary(suiteName) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${suiteName} — HASIL`);
  console.log('═'.repeat(62));
  console.log(`  ✅  Passed : ${passed}`);
  console.log(`  ❌  Failed : ${failed}`);
  console.log(`  Total  : ${passed + failed}`);
  console.log('═'.repeat(62));
  if (failed > 0) {
    console.log('\n  Test yang gagal:');
    results.filter(r => r.status === '❌').forEach(r => {
      console.log(`  • ${r.name}`);
      if (r.reason) console.log(`    → ${r.reason}`);
    });
    console.log('');
  } else {
    console.log('\n  🎉  Semua test PASSED!\n');
  }
}
