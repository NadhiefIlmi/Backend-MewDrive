#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MyDrive Restore Script
#
# Dipakai kalau VPS crash dan perlu restore ke server baru.
#
# Cara pakai:
#   ./restore.sh                          → restore backup terbaru
#   ./restore.sh 2026-10-12_02-00-00      → restore backup tanggal tertentu
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Konfigurasi — harus sama dengan backup.sh ────────────────────────────────

DB_URL="${DATABASE_URL:-postgres://nadhif:password@localhost:5432/mewdrive}"
DB_NAME="mewdrive"
STORAGE_PATH="/var/mydrive/storage/files"
BACKUP_DIR="/var/backups/mydrive"
B2_REMOTE="b2"
B2_BUCKET="mydrive-backup"
B2_DB_PATH="${B2_REMOTE}:${B2_BUCKET}/database"
B2_STORAGE_PATH="${B2_REMOTE}:${B2_BUCKET}/files"

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo ""
echo "═══════════════════════════════════════════"
echo "${LOG_PREFIX} MyDrive Restore dimulai"
echo "═══════════════════════════════════════════"

# ─── Tentukan backup yang akan di-restore ────────────────────────────────────

TARGET_DATE="${1:-}"  # argumen pertama, atau kosong untuk terbaru

mkdir -p "${BACKUP_DIR}/restore"

if [ -z "${TARGET_DATE}" ]; then
    echo "${LOG_PREFIX} Mencari backup terbaru di B2..."
    # Ambil file terbaru dari B2
    LATEST=$(rclone lsl "${B2_DB_PATH}/" 2>/dev/null | sort -k2,3 | tail -1 | awk '{print $NF}')
    if [ -z "${LATEST}" ]; then
        echo "${LOG_PREFIX} ✗ Tidak ada backup ditemukan di B2"
        exit 1
    fi
    echo "${LOG_PREFIX} Backup terbaru: ${LATEST}"
    DB_BACKUP_FILE="${LATEST}"
else
    DB_BACKUP_FILE="${DB_NAME}_${TARGET_DATE}.sql.gz"
    echo "${LOG_PREFIX} Restore backup: ${DB_BACKUP_FILE}"
fi

# ─── 1. Download database backup dari B2 ─────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [1/3] Download database backup dari B2..."

LOCAL_DUMP="${BACKUP_DIR}/restore/${DB_BACKUP_FILE}"

if rclone copy "${B2_DB_PATH}/${DB_BACKUP_FILE}" "${BACKUP_DIR}/restore/"; then
    echo "${LOG_PREFIX} ✓ Download selesai: ${LOCAL_DUMP}"
else
    echo "${LOG_PREFIX} ✗ Download backup GAGAL"
    exit 1
fi

# ─── 2. Restore database ─────────────────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [2/3] Restore database PostgreSQL..."
echo "${LOG_PREFIX} ⚠ PERHATIAN: Database ${DB_NAME} akan di-reset!"
echo ""
read -p "Lanjutkan? (ketik 'ya' untuk konfirmasi): " CONFIRM

if [ "${CONFIRM}" != "ya" ]; then
    echo "${LOG_PREFIX} Dibatalkan."
    exit 0
fi

# Drop dan recreate database
psql "${DB_URL%/${DB_NAME}}/postgres" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql "${DB_URL%/${DB_NAME}}/postgres" -c "CREATE DATABASE ${DB_NAME};"

# Restore dari dump
if gunzip -c "${LOCAL_DUMP}" | psql "${DB_URL}"; then
    echo "${LOG_PREFIX} ✓ Database berhasil di-restore"
else
    echo "${LOG_PREFIX} ✗ Restore database GAGAL"
    exit 1
fi

# ─── 3. Restore file storage dari B2 ─────────────────────────────────────────

echo ""
echo "${LOG_PREFIX} [3/3] Restore file storage dari B2..."

mkdir -p "${STORAGE_PATH}"

if rclone sync "${B2_STORAGE_PATH}/" "${STORAGE_PATH}/" --progress; then
    echo "${LOG_PREFIX} ✓ File storage berhasil di-restore"
else
    echo "${LOG_PREFIX} ✗ Restore storage GAGAL"
    exit 1
fi

# ─── 4. Jalankan migration (pastikan schema up to date) ───────────────────────

echo ""
echo "${LOG_PREFIX} Menjalankan migration..."
cd /var/mydrive/backend && npm run migrate:prod

# ─── Selesai ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════"
echo "${LOG_PREFIX} ✅ Restore selesai"
echo ""
echo "Selanjutnya:"
echo "  1. Set .env dengan konfigurasi yang benar"
echo "  2. pm2 start ecosystem.config.cjs --env production"
echo "  3. Cek: curl http://localhost:3001/api/health"
echo "═══════════════════════════════════════════"
echo ""
