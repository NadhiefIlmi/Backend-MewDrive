# MyDrive Backend API

Backend API untuk MyDrive — Personal File Management System.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Auth**: JWT + bcrypt
- **Architecture**: Controller → Service → Repository

---

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env — minimal isi DATABASE_URL dan JWT_SECRET

# 3. Buat database
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE mydrive;"

# 4. Jalankan migration
npm run migrate

# 5. Seed data awal (admin account)
npm run seed

# 6. Start server
npm run dev
```

Server berjalan di: `http://localhost:3001`

---

## Scripts

| Script | Keterangan |
|--------|------------|
| `npm run dev` | Start server development (auto-restart dengan nodemon) |
| `npm start` | Start server production |
| `npm run start:prod` | Start server dengan NODE_ENV=production |
| `npm run migrate` | Jalankan semua migration yang belum dijalankan |
| `npm run migrate:prod` | Migration dengan NODE_ENV=production |
| `npm run seed` | Seed data awal (roles + admin account) |
| `npm test` | Jalankan 150 integration tests |
| `npm run test:perf` | Test performa (cache, range requests, ETag) |
| `npm run test:security` | Test security (JWT, upload, injection) |
| `npm run test:db` | Test database optimization |
| `npm run check:prod` | Cek production readiness checklist |

---

## API Endpoints

**Base URL**: `http://localhost:3001/api`

### Health Check
```
GET /api/health
```
Response includes database connectivity status.

### Authentication
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| POST | `/auth/login` | — | Login |
| POST | `/auth/logout` | ✓ | Logout + revoke token |
| GET | `/auth/me` | ✓ | Data user aktif |

### Files
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/files` | List file |
| POST | `/files/upload` | Upload file (multipart) |
| GET | `/files/:id` | Detail file |
| PATCH | `/files/:id` | Rename / star |
| DELETE | `/files/:id` | Pindah ke trash |
| POST | `/files/:id/restore` | Restore dari trash |
| DELETE | `/files/:id/permanent` | Hapus permanen |
| GET | `/files/:id/download` | Download (support Range) |
| GET | `/files/:id/preview` | Preview inline (support Range) |
| PATCH | `/files/:id/move` | Pindah ke folder lain |
| GET | `/files/starred` | File berbintang |
| GET | `/files/recent` | File terbaru |
| GET | `/files/trash` | File di trash |
| POST | `/files/trash/bulk-restore` | Bulk restore dari trash |
| DELETE | `/files/trash/empty` | Kosongkan trash |

### Folders
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/folders` | List folder |
| POST | `/folders` | Buat folder |
| GET | `/folders/:id` | Detail folder |
| PATCH | `/folders/:id` | Rename / star / color |
| DELETE | `/folders/:id` | Pindah ke trash |
| POST | `/folders/:id/restore` | Restore |
| DELETE | `/folders/:id/permanent` | Hapus permanen (cascade) |
| PATCH | `/folders/:id/move` | Pindah ke folder lain |
| GET | `/folders/starred` | Folder berbintang |
| GET | `/folders/trash` | Folder di trash |

### Notes, Share, Search, Storage, Users, Permissions
Lihat source di `src/routes/` untuk detail lengkap.

---

## Environment Variables

Salin `.env.example` ke `.env` dan isi semua nilai.
Untuk production, lihat `.env.production.example`.

| Variable | Default | Keterangan |
|----------|---------|------------|
| `NODE_ENV` | `development` | `production` di server |
| `PORT` | `3001` | Port server |
| `DATABASE_URL` | — | **Wajib** |
| `JWT_SECRET` | — | **Wajib**, minimal 32 karakter |
| `JWT_EXPIRES_IN` | `7d` | Masa berlaku token |
| `FRONTEND_URL` | `http://localhost:5173` | **Wajib di production** (CORS) |
| `BCRYPT_ROUNDS` | `10` | `12` di production |
| `LOCAL_STORAGE_PATH` | `./storage/files` | Path penyimpanan file upload |
| `MAX_FILE_SIZE` | `10485760` | Maks ukuran file (bytes) |

---

## Project Structure

```
backend/
├── server.js                    # Entry point — startup, pool warmup, graceful shutdown
├── ecosystem.config.cjs         # PM2 config untuk production
├── src/
│   ├── app.js                   # Express app — middleware stack
│   ├── config/
│   │   ├── env.js               # Semua config dari env vars
│   │   ├── database.js          # pg Pool setup
│   │   └── validate-env.js      # Validasi env saat startup
│   ├── controllers/             # HTTP layer — request/response handling
│   ├── services/                # Business logic
│   ├── repositories/            # Database queries (parameterized)
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT verify + blacklist check
│   │   ├── rateLimiter.js       # Rate limiting per endpoint
│   │   ├── upload.middleware.js # Multer + magic bytes validation
│   │   ├── validator.js         # express-validator runner
│   │   └── errorHandler.js      # Global error handler
│   ├── routes/                  # Express routers
│   ├── validators/              # Input validation rules
│   ├── utils/
│   │   ├── cache.js             # In-memory TTL cache
│   │   ├── jwt.js               # JWT generate + verify
│   │   └── response.js          # Standar response format
│   └── database/
│       ├── migrate.js           # Migration runner
│       ├── seed.js              # Seed runner
│       ├── migrations/          # Migration files (001–012)
│       └── seeds/               # Seed files
├── scripts/
│   ├── test-integration.mjs     # Main test runner (150 tests)
│   ├── test-suite/              # Test modules per area
│   ├── check-production.mjs     # Production readiness checklist
│   ├── test-security.mjs        # Security tests (Task 15)
│   ├── test-db-optimization.mjs # DB optimization tests (Task 16)
│   └── test-performance.mjs     # Performance tests (Task 17)
├── logs/                        # Log files (gitignored)
├── storage/                     # File uploads (gitignored)
└── .env.production.example      # Template untuk production
```

---

## Security Features

- ✅ JWT dengan blacklist saat logout (tabel `revoked_tokens`)
- ✅ Password hashing dengan bcrypt
- ✅ Rate limiting: login (5/15 menit), upload (20/menit), general (100/menit)
- ✅ Input validation dengan express-validator
- ✅ SQL injection protection (parameterized queries)
- ✅ File upload validation (MIME type + magic bytes)
- ✅ CORS — hanya domain frontend yang diizinkan di production
- ✅ Security headers dengan Helmet
- ✅ `storage_path` tidak pernah bocor ke response API
- ✅ HTTP Range requests (resume download, video seek)
- ✅ ETag + 304 Not Modified (hemat bandwidth)
- ✅ Statement timeout di PostgreSQL (query >10 detik di-cancel)
- ✅ Graceful shutdown dengan hard timeout

---

## Production Deployment

### 1. Cek kesiapan

```bash
npm run check:prod
```

### 2. Setup environment

```bash
cp .env.production.example .env
# Isi semua nilai — terutama JWT_SECRET dan DATABASE_URL
```

Generate JWT_SECRET yang kuat:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Install dependencies

```bash
npm install --omit=dev
```

### 4. Jalankan migration

```bash
npm run migrate:prod
```

### 5. Start dengan PM2

```bash
# Install PM2 (sekali saja)
npm install -g pm2

# Start server
pm2 start ecosystem.config.cjs --env production

# Auto-start saat server reboot
pm2 startup
pm2 save
```

### 6. Verifikasi

```bash
# Cek status
pm2 status

# Cek health
curl http://localhost:3001/api/health

# Lihat log
pm2 logs mydrive-backend
```

### PM2 Commands

```bash
pm2 reload ecosystem.config.cjs --env production  # reload tanpa downtime
pm2 stop mydrive-backend                           # stop
pm2 restart mydrive-backend                        # restart
pm2 monit                                          # dashboard monitoring
pm2 logs mydrive-backend --lines 100               # 100 baris log terakhir
```

---

## Development Notes

### Default Admin Account

Dibuat oleh seed script:

| Field | Value |
|-------|-------|
| Email | `nadhiefilmi@gmail.com` |
| Password | `nadhif123` |
| Role | ADMIN |

**⚠️ Ganti password ini setelah pertama kali deploy ke production.**

### Running Tests

```bash
# Pastikan backend running dulu
npm run dev

# Di terminal lain
npm test        # 150 integration tests
```

Test suite secara otomatis cleanup semua data yang dibuat selama testing.

---

## Troubleshooting

**Server tidak mau start**
```bash
# Cek env vars
npm run check:prod

# Cek log
pm2 logs mydrive-backend --err
```

**Database connection error**
```bash
# Test koneksi manual
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Migration gagal**
```bash
# Lihat migration yang sudah jalan
psql "$DATABASE_URL" -c "SELECT * FROM migrations ORDER BY id;"
```

**File upload gagal**
```bash
# Cek storage directory ada dan writable
ls -la storage/
```
