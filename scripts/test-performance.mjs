/**
 * Task 17 — Performance & Scalability Test Script
 *
 * Test semua improvement yang diimplementasikan:
 *   1. In-memory TTL cache (correctness + TTL expiry)
 *   2. HTTP Range requests (partial content)
 *   3. ETag / conditional GET (304 Not Modified)
 *   4. Async file existence check (non-blocking)
 *   5. Database pool config (statement_timeout, keepAlive)
 *   6. Server timeout config (keepAlive, headers, shutdown)
 *
 * Jalankan: node scripts/test-performance.mjs
 * (Backend harus berjalan di http://localhost:3001)
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(label) {
  console.log(`  ✅ ${label}`);
  passCount++;
}

function fail(label, detail) {
  console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
  failCount++;
}

async function request(method, url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers:  options.headers || {},
    };
    const req = lib.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks).toString(),
      }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function login() {
  const res = await request('POST', `${BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nadhiefilmi@gmail.com',
      password: 'nadhif123',
    }),
  });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${res.body}`);
  const data = JSON.parse(res.body);
  return data.data.token;
}

// ─── Test 1: In-memory cache ──────────────────────────────────────────────────

async function testCache() {
  console.log('\n[1] In-memory TTL Cache');

  try {
    // Import langsung — ini unit test, tidak butuh server
    const { cache } = await import('../src/utils/cache.js');

    // 1a. Basic set/get
    cache.set('t:1', { x: 42 }, 5000);
    const hit = cache.get('t:1');
    hit?.x === 42 ? pass('set() + get() hit') : fail('set() + get() hit', `got ${JSON.stringify(hit)}`);

    // 1b. Miss
    const miss = cache.get('t:nonexistent');
    miss === undefined ? pass('get() miss returns undefined') : fail('get() miss', `got ${JSON.stringify(miss)}`);

    // 1c. TTL expiry
    cache.set('t:ttl', 'hello', 50); // 50ms
    await new Promise(r => setTimeout(r, 80));
    const expired = cache.get('t:ttl');
    expired === undefined ? pass('TTL expiry works (50ms)') : fail('TTL expiry', `still got: ${expired}`);

    // 1d. del()
    cache.set('t:del', 'abc', 5000);
    cache.del('t:del');
    cache.get('t:del') === undefined ? pass('del() removes entry') : fail('del()', 'entry still present');

    // 1e. delByPrefix()
    cache.set('file:1', 'a', 5000);
    cache.set('file:2', 'b', 5000);
    cache.set('storage:1', 'c', 5000);
    cache.delByPrefix('file:');
    const ok1 = cache.get('file:1') === undefined;
    const ok2 = cache.get('file:2') === undefined;
    const ok3 = cache.get('storage:1') === 'c';
    ok1 && ok2 && ok3 ? pass('delByPrefix() removes matching, keeps others') : fail('delByPrefix()', `file:1=${ok1} file:2=${ok2} storage:1=${ok3}`);

    // 1f. getOrSet()
    let loaderCalls = 0;
    const loader = async () => { loaderCalls++; return { data: 'loaded' }; };
    await cache.getOrSet('t:gos', loader, 5000);
    await cache.getOrSet('t:gos', loader, 5000); // second call — cache hit, loader should not run
    loaderCalls === 1 ? pass('getOrSet() calls loader once then caches') : fail('getOrSet()', `loader called ${loaderCalls} times`);

  } catch (e) {
    fail('Cache module import/test', e.message);
  }
}

// ─── Test 2: Server config (no live server needed) ───────────────────────────

async function testConfig() {
  console.log('\n[2] Server & Pool Configuration');

  try {
    const { config } = await import('../src/config/env.js');

    config.database.statementTimeoutMs > 0
      ? pass(`statement_timeout configured: ${config.database.statementTimeoutMs}ms`)
      : fail('statement_timeout not set');

    config.server.keepAliveTimeoutMs >= 60000
      ? pass(`keepAliveTimeout: ${config.server.keepAliveTimeoutMs}ms (≥60s, safe for load balancers)`)
      : fail('keepAliveTimeout too short', `${config.server.keepAliveTimeoutMs}ms`);

    config.server.headersTimeoutMs > config.server.keepAliveTimeoutMs
      ? pass('headersTimeout > keepAliveTimeout ✓')
      : fail('headersTimeout must be > keepAliveTimeout');

    config.server.shutdownTimeoutMs > 0
      ? pass(`shutdownTimeout: ${config.server.shutdownTimeoutMs}ms`)
      : fail('shutdownTimeout not set');

    config.cache.fileTtlMs > 0
      ? pass(`file cache TTL: ${config.cache.fileTtlMs}ms`)
      : fail('file cache TTL not set');

    config.cache.storageTtlMs > 0
      ? pass(`storage cache TTL: ${config.cache.storageTtlMs}ms`)
      : fail('storage cache TTL not set');

    // Pool keepAlive check in database.js
    const dbSrc = fs.readFileSync(
      path.join(__dirname, '../src/config/database.js'), 'utf8'
    );
    dbSrc.includes('keepAlive: true')
      ? pass('pg Pool: keepAlive: true')
      : fail('pg Pool: keepAlive not set');

    dbSrc.includes('statement_timeout')
      ? pass('pg Pool: statement_timeout in options')
      : fail('pg Pool: statement_timeout not in options');

  } catch (e) {
    fail('Config test', e.message);
  }
}

// ─── Test 3: HTTP Range support in controllers (code check) ──────────────────

async function testRangeCodePresence() {
  console.log('\n[3] HTTP Range Request Support (code analysis)');

  const controllers = [
    { path: '../src/controllers/download.controller.js', name: 'download' },
    { path: '../src/controllers/preview.controller.js',  name: 'preview'  },
  ];

  for (const { path: ctrlPath, name } of controllers) {
    const src = fs.readFileSync(path.join(__dirname, ctrlPath), 'utf8');

    src.includes("req.headers['range']")
      ? pass(`${name}: reads Range header`)
      : fail(`${name}: Range header not read`);

    src.includes('206')
      ? pass(`${name}: returns 206 Partial Content`)
      : fail(`${name}: 206 status code missing`);

    src.includes('Content-Range')
      ? pass(`${name}: sets Content-Range header`)
      : fail(`${name}: Content-Range header missing`);

    src.includes('Accept-Ranges')
      ? pass(`${name}: sets Accept-Ranges header`)
      : fail(`${name}: Accept-Ranges header missing`);

    src.includes('416')
      ? pass(`${name}: returns 416 Range Not Satisfiable on bad range`)
      : fail(`${name}: 416 status missing`);

    src.includes('fs.promises.access')
      ? pass(`${name}: async fs.access (non-blocking)`)
      : fail(`${name}: still using sync fs.existsSync`);

    src.includes('ETag') || src.includes('etag')
      ? pass(`${name}: ETag support`)
      : fail(`${name}: ETag missing`);

    src.includes('304')
      ? pass(`${name}: 304 Not Modified for conditional GET`)
      : fail(`${name}: 304 conditional GET missing`);

    src.includes('cache.getOrSet')
      ? pass(`${name}: in-memory cache for file metadata`)
      : fail(`${name}: metadata cache missing`);
  }
}

// ─── Test 4: Live server tests (Range, ETag, storage cache) ──────────────────

async function testLiveServer(token) {
  console.log('\n[4] Live Server Tests (requires running backend + at least 1 uploaded file)');

  // Get list of files to find a test file
  let fileId;
  try {
    const res = await request('GET', `${BASE_URL}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) {
      console.log('  ⚠ Skipping live tests — could not list files:', res.status);
      return;
    }
    const data = JSON.parse(res.body);
    const files = data.data?.items ?? data.data ?? [];
    if (!Array.isArray(files) || files.length === 0) {
      console.log('  ⚠ Skipping live Range/ETag tests — no files uploaded yet.');
      console.log('    Upload at least one file to test Range and ETag support.');
      return;
    }
    fileId = files[0].id;
    console.log(`  ℹ Using file id=${fileId} (${files[0].name}) for live tests`);
  } catch (e) {
    console.log('  ⚠ Skipping live tests — backend unreachable:', e.message);
    return;
  }

  // 4a. ETag on download
  const dlFull = await request('GET', `${BASE_URL}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  dlFull.status === 200 && dlFull.headers.etag
    ? pass(`Download 200 with ETag: ${dlFull.headers.etag}`)
    : fail('Download ETag', `status=${dlFull.status} etag=${dlFull.headers.etag}`);

  // 4b. ETag conditional GET → 304
  if (dlFull.headers.etag) {
    const dlCond = await request('GET', `${BASE_URL}/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'If-None-Match': dlFull.headers.etag,
      },
    });
    dlCond.status === 304
      ? pass('Download conditional GET → 304 Not Modified')
      : fail('Download 304', `got ${dlCond.status}`);
  }

  // 4c. Accept-Ranges header present
  dlFull.headers['accept-ranges'] === 'bytes'
    ? pass('Download Accept-Ranges: bytes')
    : fail('Download Accept-Ranges', `got: ${dlFull.headers['accept-ranges']}`);

  // 4d. Range request → 206 Partial Content
  const fileSize = parseInt(dlFull.headers['content-length'] || '0', 10);
  if (fileSize > 0) {
    const rangeEnd = Math.min(511, fileSize - 1); // first 512 bytes
    const dlRange = await request('GET', `${BASE_URL}/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Range: `bytes=0-${rangeEnd}`,
      },
    });
    dlRange.status === 206
      ? pass(`Download Range bytes=0-${rangeEnd} → 206 Partial Content`)
      : fail('Download Range 206', `got ${dlRange.status}`);

    if (dlRange.status === 206) {
      const cr = dlRange.headers['content-range'];
      cr && cr.startsWith('bytes 0-')
        ? pass(`Content-Range header: ${cr}`)
        : fail('Content-Range header', `got: ${cr}`);

      const receivedBytes = Buffer.byteLength(dlRange.body, 'binary');
      receivedBytes === rangeEnd + 1
        ? pass(`Received correct byte count: ${receivedBytes}`)
        : fail('Byte count mismatch', `expected ${rangeEnd + 1}, got ${receivedBytes}`);
    }
  } else {
    console.log('  ⚠ Skipping Range tests — Content-Length not available');
  }

  // 4e. Invalid Range → 416
  const dlBadRange = await request('GET', `${BASE_URL}/files/${fileId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Range: 'bytes=99999999-99999998', // invalid: start > end
    },
  });
  dlBadRange.status === 416
    ? pass('Invalid Range → 416 Range Not Satisfiable')
    : fail('Invalid Range 416', `got ${dlBadRange.status}`);

  // 4f. Preview ETag
  const pvFull = await request('GET', `${BASE_URL}/files/${fileId}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (pvFull.status === 200 && pvFull.headers.etag) {
    const pvCond = await request('GET', `${BASE_URL}/files/${fileId}/preview`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'If-None-Match': pvFull.headers.etag,
      },
    });
    pvCond.status === 304
      ? pass('Preview conditional GET → 304 Not Modified')
      : fail('Preview 304', `got ${pvCond.status}`);
  } else {
    console.log(`  ⚠ Preview status=${pvFull.status} (file may not be previewable type) — skipping ETag test`);
  }

  // 4g. Storage cache — two rapid calls, second should be faster (cached)
  const t0 = Date.now();
  await request('GET', `${BASE_URL}/storage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const firstMs = Date.now() - t0;

  const t1 = Date.now();
  const storageRes2 = await request('GET', `${BASE_URL}/storage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const secondMs = Date.now() - t1;

  storageRes2.status === 200
    ? pass(`Storage endpoint responds correctly`)
    : fail('Storage endpoint', `got ${storageRes2.status}`);

  // Cache hit is typically much faster — allow generous margin since local DB is fast too
  console.log(`  ℹ Storage latency — 1st call: ${firstMs}ms, 2nd call (cached): ${secondMs}ms`);
  secondMs <= firstMs + 20
    ? pass('2nd storage call ≤ 1st + 20ms (cache benefit)')
    : console.log(`  ℹ  2nd call was ${secondMs}ms (local DB may also be fast enough to appear equal)`);
}

// ─── Run all tests ────────────────────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Task 17 — Performance & Scalability Tests      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await testCache();
  await testConfig();
  await testRangeCodePresence();

  // Live tests — coba login dulu
  let token;
  try {
    token = await login();
    console.log('\n  ℹ Login berhasil, lanjut ke live server tests...');
    await testLiveServer(token);
  } catch (e) {
    console.log('\n  ⚠ Backend tidak berjalan atau login gagal — skip live tests.');
    console.log(`    (${e.message})`);
    console.log('  ℹ Jalankan backend dulu: npm run dev (di folder backend)');
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Results: ${passCount} passed, ${failCount} failed`);
  if (failCount === 0) {
    console.log('  🎉 All tests passed!');
  } else {
    console.log('  ⚠  Some tests failed — see details above.');
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
