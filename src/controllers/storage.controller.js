import { query } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';
import { cache } from '../utils/cache.js';
import { config } from '../config/env.js';

// GET /api/storage
export const getStorage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = `storage:${userId}`;

    // Cache storage info — data ini agak mahal (2 queries) dan sering dipanggil
    // dari sidebar setiap kali halaman di-render. TTL 10 detik = cukup fresh.
    const cached = cache.get(cacheKey);
    if (cached) {
      return sendSuccess(res, cached);
    }

    // Ambil storage_used dan storage_quota dari tabel users
    const userResult = await query(
      `SELECT storage_used, storage_quota FROM users WHERE id = $1`,
      [userId]
    );
    const { storage_used, storage_quota } = userResult.rows[0] ?? { storage_used: 0, storage_quota: 0 };

    const used  = Number(storage_used);
    const quota = Number(storage_quota);
    const pct   = quota > 0 ? Math.round((used / quota) * 100) : 0;
    const free  = Math.max(0, quota - used);

    // Breakdown per kategori mime — hanya file aktif (tidak trashed)
    const breakdownResult = await query(
      `SELECT
         CASE
           WHEN mime_type ILIKE 'image/%'                                            THEN 'Gambar'
           WHEN mime_type ILIKE 'video/%'                                            THEN 'Video'
           WHEN mime_type ILIKE 'audio/%'                                            THEN 'Audio'
           WHEN mime_type IN ('application/pdf')                                     THEN 'PDF'
           WHEN mime_type ILIKE '%spreadsheet%' OR mime_type ILIKE '%excel%'
             OR mime_type = 'text/csv'                                               THEN 'Spreadsheet'
           WHEN mime_type ILIKE '%zip%' OR mime_type ILIKE '%rar%'
             OR mime_type ILIKE '%tar%' OR mime_type ILIKE '%7z%'
             OR mime_type ILIKE '%gzip%'                                             THEN 'Arsip'
           WHEN mime_type ILIKE 'text/%' OR mime_type ILIKE '%word%'
             OR mime_type ILIKE '%document%'                                         THEN 'Dokumen'
           ELSE 'Lainnya'
         END AS category,
         COUNT(*)::int AS file_count,
         COALESCE(SUM(size), 0)::bigint AS total_size
       FROM files
       WHERE user_id = $1 AND is_trashed = false
       GROUP BY category
       ORDER BY total_size DESC`,
      [userId]
    );

    const breakdown = breakdownResult.rows.map(row => ({
      category:   row.category,
      file_count: row.file_count,
      total_size: Number(row.total_size),
      pct:        quota > 0 ? Math.round((Number(row.total_size) / quota) * 100) : 0,
    }));

    const result = {
      storage_used:  used,
      storage_quota: quota,
      storage_free:  free,
      pct_used:      pct,
      breakdown,
    };

    // Simpan ke cache — TTL 10 detik (dikonfigurasi via CACHE_STORAGE_TTL_MS)
    cache.set(cacheKey, result, config.cache.storageTtlMs);

    return sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};
