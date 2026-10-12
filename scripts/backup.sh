#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MyDrive Backup Script
#
# Backup otomatis setiap hari:
#   1. Database PostgreSQL → pg_dump → compress → upload ke Backblaze B2
#   2. File storage → rclone sync ke Backblaze B2
#   3. Simpan 7 hari terakhir, hapus yang lama
#
# Setup:
#   1. Install rclone: sudo apt install rclone
#   2. Konfigurasi rclone ke B2: rclone config
#   3. Isi variabel di bawah sesuai environment kamu
#   4. Beri permission: chmod +x backup.sh
#   5. Test manual: ./backup.sh
#   6. Jadwalkan cronjob: crontab -e
#      → 0 2 * * * /var/mydrive/backend/scripts/backup.sh >> /var/log/mydrive-backup.log 2>&1
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail  # exit on error, undefined var, pipe fail

# ─── Konfigurasi — EDIT SESUAI SERVER KAMU ────────────────────────────────────

# Database
DB_URL="${DATABASE_URL:-postgres://myuser:mypassword@localhost:5432/mydrive}"
DB_NAME="mydrive"                    # nama database

# Storage
STORAGE_PATH="/var/mydrive/storage"  # path folder file upload di VPS
APP_PATH="/var/mydrive/backend"      # path folder backend

# Backup
BACKUP_DIR="/var/backups/mydrive"    # tempat backup sementara di VPS
RETENTION_DAYS=7                     # simpan backup berapa hari

# Backblaze B2 via rclone
# Nama remote harus sama dengan yang dikonfigurasi di: rclone config
B2_REMOTE="b2"                       # nama remote rclone
B2_BUCKET="mydrive-backup"           # nama bucket B2 kamu
B2_DB_PATH="${B2_REMOTE}:${B2_BUCKET}/database"
B2_STORAGE_PATH="${B2_REMOTE}:${B2_BUCKET}/files"

# ─── Setup ────────────────────────────────────────────────────────────────────

DATE=$(date +%Y-%m-%d_%H-%M-%S)
DAY=$(date +%A | tr '[:upper:]' '[:lower:]')  # monday, tuesday, dst
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo ""
echo "═══════════════════════════════════════════"
echo "${LOG_PREFIX} MyDrive Backup dimulai"
echo "═══════════════════════════════════════════"

# Buat direktori backup kalau belum ada
mkdir -p "${BACKUP_DIR}/database"

# ─── 1. Backup Database ───────────────────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [1/3] Backup database PostgreSQL..."

DUMP_FILE="${BACKUP_DIR}/database/${DB_NAME}_${DATE}.sql.gz"

# pg_dump compress langsung ke gzip — tidak butuh space 2x
if pg_dump "${DB_URL}" | gzip -9 > "${DUMP_FILE}"; then
    DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
    echo "${LOG_PREFIX} ✓ Database dump selesai: ${DUMP_FILE} (${DUMP_SIZE})"
else
    echo "${LOG_PREFIX} ✗ Database dump GAGAL"
    exit 1
fi

# ─── 2. Upload Database Backup ke B2 ─────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [2/3] Upload database backup ke Backblaze B2..."

if rclone copy "${DUMP_FILE}" "${B2_DB_PATH}/" \
    --progress \
    --stats-one-line \
    2>&1 | grep -E "(Transferred|ERROR|NOTICE)"; then
    echo "${LOG_PREFIX} ✓ Database backup ter-upload ke B2"
else
    echo "${LOG_PREFIX} ✗ Upload database ke B2 GAGAL"
    exit 1
fi

# ─── 3. Sync File Storage ke B2 ──────────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [3/3] Sync file storage ke Backblaze B2..."

if [ -d "${STORAGE_PATH}" ]; then
    # rclone sync: mirror lokal ke B2 (hapus di B2 kalau hapus di lokal)
    # Pakai --backup-dir untuk simpan file yang dihapus di folder tersendiri
    if rclone sync "${STORAGE_PATH}/" "${B2_STORAGE_PATH}/" \
        --progress \
        --stats-one-line \
        --backup-dir "${B2_REMOTE}:${B2_BUCKET}/deleted/${DATE}" \
        2>&1 | grep -E "(Transferred|ERROR|NOTICE)"; then
        echo "${LOG_PREFIX} ✓ File storage ter-sync ke B2"
    else
        echo "${LOG_PREFIX} ✗ Sync storage ke B2 GAGAL"
        exit 1
    fi
else
    echo "${LOG_PREFIX} ⚠ Storage path tidak ditemukan: ${STORAGE_PATH}"
fi

# ─── 4. Cleanup backup lokal yang sudah tua ──────────────────────────────────

echo ""
echo "${LOG_PREFIX} Cleanup backup lokal lebih dari ${RETENTION_DAYS} hari..."

find "${BACKUP_DIR}/database" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "${LOG_PREFIX} ✓ Cleanup selesai"

# ─── 5. Verifikasi backup terakhir ───────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} Verifikasi backup terbaru di B2..."

# List file terbaru di B2 untuk konfirmasi
if rclone lsl "${B2_DB_PATH}/" --max-depth 1 2>/dev/null | tail -5; then
    echo "${LOG_PREFIX} ✓ Backup B2 terverifikasi"
else
    echo "${LOG_PREFIX} ⚠ Tidak bisa verifikasi backup B2"
fi

# ─── Selesai ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════"
echo "${LOG_PREFIX} ✅ Backup selesai"
echo "  Database: ${DUMP_FILE}"
echo "  Storage:  ${B2_STORAGE_PATH}/"
echo "═══════════════════════════════════════════"
echo ""
