# MewDrive Backend — Self-Hosted Cloud Storage API

MewDrive Backend adalah REST API berperforma tinggi yang dibangun menggunakan **Node.js (Express.js + ESM)**. Backend ini menjadi tulang punggung seluruh operasi penyimpanan file, manajemen folder, autentikasi JWT, berbagi file, catatan (notes), tugas (tasks), serta integrasi notifikasi Telegram.

> 🔗 **Repositori Terkait:** Antarmuka web pengguna (*frontend*) untuk sistem ini tersedia di [**Frontend-MewDrive (TanStack Start & React 19)**](https://github.com/NadhiefIlmi/Frontend-MewDrive).

---

## 🚀 Fitur Utama

- **Authentication & Authorization:** JWT-based login/logout dengan refresh token, bcrypt password hashing, RBAC (Role-Based Access Control) berbasis tabel `roles` & `permissions`, dan revocation token (blacklist via `revoked_tokens`).
- **File & Folder Management:** Upload multi-file (Multer), download stream, preview dokumen/gambar/video, move/rename/soft-delete dengan trash & restore, favorit, dan kuota storage per user.
- **Full-Text Search:** Pencarian file dan folder berbasis `ILIKE` PostgreSQL dengan highlight hasil.
- **Share Links:** Pembuatan link berbagi publik dengan slug unik, opsi password, batas waktu kedaluwarsa, dan kontrol permission (`view`, `download`).
- **Notes (Rich Text):** CRUD catatan dengan dukungan konten rich-text yang disimpan per user.
- **Tasks:** Manajemen tugas dengan attachment file, status, deadline, dan prioritas.
- **Telegram Integration:** Notifikasi dan pengiriman file via Telegram Bot dengan enkripsi token AES-256.
- **Audit Logging:** Pencatatan otomatis setiap aksi krusial (upload, delete, share, login) ke tabel `audit_logs`.
- **Security Hardening:** Helmet.js security headers, CORS whitelist, rate limiting per-IP (express-rate-limit), JWT revocation, input validation (express-validator), dan bcrypt dengan salting.
- **Performance:** Compression Gzip/Brotli, in-memory cache (file & storage), PostgreSQL connection pool dengan tuning `max/min/idle/statement timeout`, dan 18 database migration dengan indeks performa.
- **CI/CD:** GitHub Actions workflow otomatis deploy ke VPS via SSH + PM2 ecosystem.

---

## 🛠️ Tech Stack

| Komponen | Pilihan Teknologi | Versi / Keterangan |
|---|---|---|
| **Runtime** | Node.js (ESM) | `v20+` dengan ECMAScript Modules (`"type": "module"`) |
| **HTTP Framework** | Express.js | `^4.18.2` — HTTP server, routing, middleware pipeline |
| **Database** | PostgreSQL | `15+` via driver `pg` `^8.11.3` dengan connection pool |
| **Authentication** | JSON Web Token (`jsonwebtoken`) | `^9.0.2` — JWT signing & verification |
| **Password Hashing** | bcrypt | `^5.1.1` — salted password hash |
| **File Upload** | Multer | `^1.4.5-lts.1` — multipart/form-data handler |
| **Security** | Helmet.js | `^7.1.0` — HTTP security headers OWASP |
| **Rate Limiting** | express-rate-limit | `^7.1.5` — Token bucket per IP |
| **Input Validation** | express-validator | `^7.0.1` — Schema-based request validation |
| **Compression** | compression | `^1.7.4` — Gzip response untuk JSON API |
| **Logging** | Morgan | `^1.10.0` — HTTP request logger |
| **Scheduler** | node-cron | `^3.0.3` — Cron job untuk cleanup & laporan otomatis |
| **Process Manager** | PM2 (ecosystem.config.cjs) | Clustering & auto-restart di production |
| **CI/CD** | GitHub Actions | Auto-deploy ke VPS via SSH + PM2 reload |

---

## 📁 Struktur Direktori & Penjelasan File

Struktur proyek mengadopsi prinsip **Layered Architecture** (Config → Middleware → Routes → Controllers → Services → Repositories):

```text
backend/
├── server.js                         # Entry point: inisialisasi HTTP server & graceful shutdown
├── src/
│   ├── app.js                        # Setup Express: middleware pipeline (cors, helmet, compression, morgan, rate limiter)
│   ├── config/
│   │   ├── database.js               # PostgreSQL connection pool dengan tuning (max/min/idle/statement timeout)
│   │   ├── env.js                    # Loader & parser environment variables dengan default value
│   │   └── validate-env.js           # Validasi ketat variabel wajib saat startup — fail-fast jika tidak lengkap
│   ├── controllers/                  # HTTP request handlers (thin layer — delegasi ke service)
│   │   ├── auth.controller.js        # Login, logout, refresh token, change password
│   │   ├── upload.controller.js      # Upload file multi-part, validasi MIME type & ukuran
│   │   ├── download.controller.js    # Download file stream dengan range support
│   │   ├── preview.controller.js     # Preview file (gambar/dokumen/video) dengan caching
│   │   ├── file.controller.js        # CRUD file: list, detail, rename, move, trash, restore, favorit
│   │   ├── folder.controller.js      # CRUD folder: buat, rename, move, trash, restore, icon
│   │   ├── search.controller.js      # Full-text search file & folder dengan highlight
│   │   ├── share.controller.js       # Buat/hapus share link, akses via slug & password
│   │   ├── storage.controller.js     # Info kuota storage: total, terpakai, sisa per user
│   │   ├── notes.controller.js       # CRUD catatan rich-text per user
│   │   ├── task.controller.js        # CRUD task dengan attachment file, status, deadline
│   │   ├── telegram.controller.js    # Simpan/hapus token Telegram Bot, kirim notifikasi
│   │   ├── permission.controller.js  # Kelola permission RBAC antar user
│   │   └── user.controller.js        # Admin: list user, buat, edit, reset password, kuota
│   ├── services/                     # Business logic layer (validasi, transformasi, orkestrasi)
│   │   ├── auth.service.js           # Logika login/logout, JWT sign, bcrypt verify, token revocation
│   │   ├── file.service.js           # Logika bisnis file: validasi kepemilikan, trigger audit log
│   │   ├── folder.service.js         # Logika bisnis folder: hierarki, batas kedalaman
│   │   ├── share.service.js          # Generasi slug unik, enkripsi password share link
│   │   ├── notes.service.js          # Logika bisnis catatan per user
│   │   ├── task.service.js           # Logika bisnis task dengan attachment & status machine
│   │   ├── telegram.service.js       # Enkripsi AES-256 token Telegram, komunikasi Bot API
│   │   ├── permission.service.js     # Logika RBAC: cek, beri, cabut permission
│   │   ├── user.service.js           # Logika admin user: kuota, peran, reset password
│   │   └── report.service.js         # Generasi laporan storage & aktivitas untuk scheduler
│   ├── repositories/                 # Data access layer (query SQL murni ke PostgreSQL)
│   │   ├── user.repository.js        # Query CRUD users, peran, kuota
│   │   ├── file.repository.js        # Query CRUD files, search, favorit, trash
│   │   ├── folder.repository.js      # Query CRUD folders, hierarki, trash
│   │   ├── share.repository.js       # Query share_links: buat, cari slug, cek expired
│   │   ├── notes.repository.js       # Query CRUD notes per user
│   │   ├── task.repository.js        # Query CRUD tasks & task_files attachment
│   │   ├── telegram.repository.js    # Query simpan/ambil/hapus token Telegram terenkripsi
│   │   ├── token.repository.js       # Query revoked_tokens: blacklist, cleanup expired
│   │   ├── permission.repository.js  # Query permissions & role_permissions RBAC
│   │   └── search.repository.js      # Query full-text search dengan ILIKE & ranking
│   ├── routes/                       # Express Router — pemetaan endpoint ke controller
│   │   ├── index.js                  # Root router: health check & mount semua sub-router
│   │   ├── auth.routes.js            # POST /auth/login, /auth/logout, /auth/refresh, /auth/change-password
│   │   ├── file.routes.js            # GET/POST/PATCH/DELETE /files/*
│   │   ├── folder.routes.js          # GET/POST/PATCH/DELETE /folders/*
│   │   ├── upload.routes.js          # POST /upload (multipart)
│   │   ├── download.routes.js        # GET /download/:id, /preview/:id
│   │   ├── search.routes.js          # GET /search?q=
│   │   ├── share.routes.js           # POST/GET/DELETE /share/*
│   │   ├── storage.routes.js         # GET /storage/info
│   │   ├── notes.routes.js           # GET/POST/PATCH/DELETE /notes/*
│   │   ├── task.routes.js            # GET/POST/PATCH/DELETE /tasks/*
│   │   ├── telegram.routes.js        # POST/DELETE /telegram/token, POST /telegram/notify
│   │   ├── permission.routes.js      # GET/POST/DELETE /permissions/*
│   │   ├── role.routes.js            # GET /roles
│   │   └── user.routes.js            # GET/POST/PATCH/DELETE /users/* (admin only)
│   ├── middleware/
│   │   ├── auth.middleware.js         # JWT verification & inject user ke req.user
│   │   ├── rateLimiter.js            # Token bucket rate limiting per-IP (express-rate-limit)
│   │   ├── upload.middleware.js       # Multer konfigurasi diskStorage, MIME whitelist, size limit
│   │   ├── validator.js              # Wrapper express-validator: validasi & sanitasi request body/params
│   │   └── errorHandler.js           # Global error handler: mapping error ke response terstandarisasi
│   ├── database/
│   │   ├── migrate.js                # CLI runner: eksekusi semua migration secara sequential
│   │   ├── seed.js                   # CLI runner: eksekusi data seed awal
│   │   ├── migrations/               # 18 file DDL migrasi terurut (001–018)
│   │   │   ├── 001_create_roles_table.js
│   │   │   ├── 002_create_users_table.js
│   │   │   ├── 003_create_permissions_tables.js
│   │   │   ├── 004_create_folders_table.js
│   │   │   ├── 005_create_files_table.js
│   │   │   ├── 006_add_icon_to_folders.js
│   │   │   ├── 007_add_last_accessed_to_files.js
│   │   │   ├── 008_create_notes_table.js
│   │   │   ├── 009_create_share_links_table.js
│   │   │   ├── 010_cleanup_unused_permissions.js
│   │   │   ├── 011_create_revoked_tokens_table.js
│   │   │   ├── 012_add_performance_indexes.js
│   │   │   ├── 013_add_slug_to_share_links.js
│   │   │   ├── 014_create_tasks_table.js
│   │   │   ├── 015_create_task_files_table.js
│   │   │   ├── 016_create_telegram_tables.js
│   │   │   ├── 017_create_notification_tables.js
│   │   │   └── 018_create_audit_logs_table.js
│   │   └── seeds/
│   │       ├── 001_seed_initial_data.js  # Seed roles & admin user default
│   │       └── 002_seed_permissions.js   # Seed permission RBAC awal
│   ├── utils/
│   │   ├── jwt.js                    # Helper sign, verify, decode JWT
│   │   ├── response.js               # Helper standar JSON envelope: success & error
│   │   ├── cache.js                  # In-memory TTL cache untuk file info & storage stats
│   │   └── auditLog.js               # Helper catat aktivitas ke tabel audit_logs
│   ├── validators/                   # Schema validasi express-validator per domain
│   │   ├── auth.validator.js
│   │   ├── file.validator.js
│   │   ├── folder.validator.js
│   │   ├── notes.validator.js
│   │   ├── share.validator.js
│   │   ├── task.validator.js
│   │   ├── telegram.validator.js
│   │   └── user.validator.js
│   └── scheduler.js                  # node-cron: cleanup token expired & laporan storage otomatis
├── scripts/                          # Script utilitas & test suite
│   ├── backup.sh                     # Backup database PostgreSQL & storage ke file
│   ├── restore.sh                    # Restore backup database & storage
│   ├── check-production.mjs          # Pre-deploy checklist: validasi env, DB, storage
│   ├── test-integration.mjs          # Integration test suite: auth, file, folder, share
│   ├── test-security.mjs             # Security test: JWT bypass, IDOR, rate limit, XSS
│   ├── test-performance.mjs          # Performance benchmark: throughput, latency, DB query
│   ├── test-db-optimization.mjs      # DB query analysis: index usage, slow query detection
│   └── test-suite/                   # Modular test suite per domain
│       ├── helpers.mjs               # Shared test helpers: HTTP client, auth token
│       ├── test-auth.mjs             # Test: login, logout, refresh, change password
│       ├── test-files.mjs            # Test: upload, list, download, delete, trash
│       ├── test-folders.mjs          # Test: buat, rename, move, trash, restore folder
│       ├── test-notes.mjs            # Test: CRUD catatan rich-text
│       ├── test-search.mjs           # Test: full-text search file & folder
│       ├── test-share.mjs            # Test: share link create, access, password, expire
│       ├── test-storage.mjs          # Test: info kuota, batas upload
│       ├── test-change-password.mjs  # Test: change password dengan validasi lama & baru
│       └── test-security.mjs         # Test security: IDOR, auth bypass, brute-force
├── logs/                             # Log file (di-ignore oleh Git)
│   └── .gitignore
├── ecosystem.config.cjs              # PM2 cluster config untuk production
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions: auto-deploy ke VPS via SSH
├── .env.example                      # Template environment variable
├── .env.production.example           # Template env khusus production
├── .gitignore
└── package.json
```

---

## ⚙️ Persyaratan Sistem

- **Node.js:** Versi 20.x atau lebih baru
- **PostgreSQL:** Versi 15 atau lebih baru
- **npm:** Versi 10.x atau lebih baru
- **PM2:** *(Opsional)* untuk production process management

---

## 🚀 Panduan Menjalankan

### 1. Masuk ke Direktori Backend
```bash
cd backend
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin template `.env.example` menjadi `.env` dan sesuaikan nilainya:
```bash
cp .env.example .env
```

### 4. Jalankan Migrasi Database
```bash
npm run migrate
```

### 5. (Opsional) Jalankan Seed Data Awal
```bash
npm run seed
```

### 6. Menjalankan Development Server
```bash
npm run dev
```
Server akan aktif di: **`http://localhost:3001`**

### 7. Membangun & Menjalankan Production
```bash
# Production langsung
npm run start:prod

# Menggunakan PM2 (cluster mode)
pm2 start ecosystem.config.cjs
```

---

## ⚙️ Konfigurasi Environment (`.env`)

| Variabel | Contoh Nilai | Wajib? | Keterangan |
|---|---|---|---|
| `NODE_ENV` | `development` | Ya | `development` / `production` |
| `PORT` | `3001` | Ya | Port HTTP server |
| `API_URL` | `http://localhost:3001` | Ya | Base URL API (untuk link internal) |
| `FRONTEND_URL` | `http://localhost:5173` | Ya | URL frontend untuk CORS whitelist |
| `DATABASE_URL` | `postgres://user:pass@127.0.0.1:5432/purrdocs` | Ya | PostgreSQL connection string |
| `JWT_SECRET` | `random-string-panjang` | Ya | Secret key signing JWT (min. 32 char) |
| `JWT_EXPIRES_IN` | `7d` | Tidak | Masa berlaku JWT (default: `7d`) |
| `BCRYPT_ROUNDS` | `10` | Tidak | Jumlah salt rounds bcrypt (default: `10`) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Tidak | Window rate limit dalam ms (default: 15 menit) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Tidak | Maks request per window per IP |
| `STORAGE_DRIVER` | `local` | Ya | Driver penyimpanan: `local` |
| `LOCAL_STORAGE_PATH` | `./storage/files` | Ya | Path direktori penyimpanan file lokal |
| `MAX_FILE_SIZE` | `10485760` | Tidak | Batas ukuran file upload dalam bytes (default: 10MB) |
| `TELEGRAM_ENCRYPTION_KEY` | `64 hex chars` | Tidak | Kunci AES-256 untuk enkripsi token Telegram |
| `CORS_ORIGINS` | `https://drive.example.com` | Tidak | Multi-domain CORS (comma-separated, production) |
| `LOG_LEVEL` | `debug` | Tidak | Level logging: `debug` / `info` / `warn` / `error` |

---

## 🧪 Pengujian & Quality Assurance

```bash
# Integration test suite (auth, file, folder, notes, search, share)
npm test

# Security test (JWT bypass, IDOR, rate limit, XSS)
npm run test:security

# Performance benchmark (throughput, latency, DB query)
npm run test:perf

# Database query optimization analysis
npm run test:db

# Pre-deploy production checklist
npm run check:prod
```

---

## 📡 Daftar Endpoint API

Semua endpoint API memerlukan `Authorization: Bearer <token>` kecuali yang ditandai **Public**. Base path: `/api/v1`

| Modul | Method | Endpoint | Deskripsi |
|---|:---:|---|---|
| **Health** | `GET` | `/api/v1/health` | Status server & latency DB |
| **Auth** | `POST` | `/api/v1/auth/login` | Login & dapatkan JWT |
| **Auth** | `POST` | `/api/v1/auth/logout` | Logout & revoke token |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Refresh JWT |
| **Auth** | `POST` | `/api/v1/auth/change-password` | Ganti password user |
| **Files** | `GET` | `/api/v1/files` | List file (filter, sort, paginasi) |
| **Files** | `GET` | `/api/v1/files/:id` | Detail file |
| **Files** | `PATCH` | `/api/v1/files/:id` | Rename / move file |
| **Files** | `DELETE` | `/api/v1/files/:id` | Soft-delete ke trash |
| **Files** | `POST` | `/api/v1/files/:id/restore` | Restore dari trash |
| **Files** | `POST` | `/api/v1/files/:id/favorite` | Toggle favorit file |
| **Upload** | `POST` | `/api/v1/upload` | Upload file (multipart/form-data) |
| **Download** | `GET` | `/api/v1/download/:id` | Download file stream |
| **Preview** | `GET` | `/api/v1/preview/:id` | Preview file (gambar/PDF/video) |
| **Folders** | `GET/POST` | `/api/v1/folders` | List & buat folder |
| **Folders** | `PATCH/DELETE` | `/api/v1/folders/:id` | Edit & hapus folder |
| **Search** | `GET` | `/api/v1/search?q=` | Full-text search file & folder |
| **Storage** | `GET` | `/api/v1/storage/info` | Info kuota storage user |
| **Share** | `POST` | `/api/v1/share` | Buat share link publik |
| **Share** | `GET` | `/api/v1/share/:slug` | Akses share link (Public) |
| **Notes** | `GET/POST` | `/api/v1/notes` | List & buat catatan |
| **Notes** | `PATCH/DELETE` | `/api/v1/notes/:id` | Edit & hapus catatan |
| **Tasks** | `GET/POST` | `/api/v1/tasks` | List & buat task |
| **Tasks** | `PATCH/DELETE` | `/api/v1/tasks/:id` | Edit & hapus task |
| **Telegram** | `POST` | `/api/v1/telegram/token` | Simpan token Telegram Bot |
| **Telegram** | `DELETE` | `/api/v1/telegram/token` | Hapus token Telegram Bot |
| **Users** | `GET` | `/api/v1/users` | List semua user (admin) |
| **Users** | `POST` | `/api/v1/users` | Buat user baru (admin) |
| **Users** | `PATCH` | `/api/v1/users/:id` | Edit user & kuota (admin) |

---

## 🔐 Keamanan & Middleware Pipeline

Setiap request diproses melalui pipeline middleware berurutan:

1. **`compression`** — Gzip/Brotli response JSON (threshold 1KB), skip file binary.
2. **`helmet`** — OWASP security headers (`X-Frame-Options: sameorigin`, `X-Content-Type-Options`, dll).
3. **`cors`** — Whitelist origin frontend, multi-domain via `CORS_ORIGINS`, credentials enabled.
4. **`morgan`** — HTTP access logging format dev/combined.
5. **`generalRateLimiter`** — Token bucket 100 req/15 menit per IP, counter di header response.
6. **`auth.middleware`** — Verifikasi JWT, cek token revocation, inject `req.user`.
7. **`validator`** — express-validator schema check, gagal → 422 Unprocessable Entity.
8. **`errorHandler`** — Global catch-all: mapping error ke response terstandarisasi.

---

## 🛠️ Troubleshooting & Solusi

### 1. Error: `DATABASE_URL is required`
- **Penyebab:** Variabel `DATABASE_URL` belum diisi di `.env`.
- **Solusi:** Jalankan `cp .env.example .env` dan isi `DATABASE_URL` yang valid, lalu restart server.

### 2. Error: `CORS policy` dari frontend
- **Penyebab:** `FRONTEND_URL` tidak sesuai dengan origin browser.
- **Solusi:** Pastikan `FRONTEND_URL=http://localhost:5173` di `.env` backend cocok dengan port dev server frontend.

### 3. Upload gagal dengan error `File too large`
- **Penyebab:** Ukuran file melebihi `MAX_FILE_SIZE` (default 10MB).
- **Solusi:** Naikkan nilai `MAX_FILE_SIZE` di `.env` (dalam bytes). Contoh 50MB: `MAX_FILE_SIZE=52428800`.

### 4. Migration gagal dengan error duplikasi tabel
- **Penyebab:** Migration sudah pernah dijalankan sebelumnya.
- **Solusi:** Setiap migration menggunakan `IF NOT EXISTS` — aman dijalankan berulang. Jika error persisten, cek koneksi DB via `npm run check:prod`.

### 5. Telegram notification tidak terkirim
- **Penyebab:** `TELEGRAM_ENCRYPTION_KEY` kosong atau token Bot tidak valid.
- **Solusi:** Generate key: `openssl rand -hex 32` dan isi ke `.env`. Pastikan token Telegram Bot sudah disimpan via `POST /api/v1/telegram/token`.

---

## 🔗 Ekosistem Repositori MewDrive

| Komponen | Repositori GitHub | Deskripsi & Stack |
|---|---|---|
| **Backend REST API** | [Backend-MewDrive](https://github.com/NadhiefIlmi/Backend-MewDrive) | REST API (Node.js, Express, PostgreSQL, JWT, Multer, PM2) |
| **Frontend Web App** | [Frontend-MewDrive](https://github.com/NadhiefIlmi/Frontend-MewDrive) | Cloud Storage UI (TanStack Start, React 19, Tailwind CSS v4, shadcn/ui) |
