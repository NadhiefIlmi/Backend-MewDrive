/**
 * Lightweight in-memory TTL cache — tidak butuh Redis.
 *
 * Dipakai untuk:
 * - File metadata (preview/download dibaca berulang-ulang)
 * - Storage quota per user (sering dipanggil dari sidebar)
 *
 * Tidak cocok untuk:
 * - Data yang harus konsisten real-time (gunakan DB langsung)
 * - Data yang sangat besar (gunakan Redis)
 *
 * Untuk skala 2–10 user di server lokal, ini sudah cukup.
 */

class TTLCache {
  constructor() {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this._store = new Map();

    // Cleanup entri yang expired setiap 5 menit
    // Mencegah memory leak dari entri yang tidak pernah di-get lagi
    const FIVE_MINUTES = 5 * 60 * 1000;
    const timer = setInterval(() => this._evict(), FIVE_MINUTES);
    timer.unref(); // Jangan biarkan interval ini mencegah process exit
  }

  /**
   * Simpan nilai ke cache.
   * @param {string} key
   * @param {any} value
   * @param {number} ttlMs - Time to live dalam milliseconds
   */
  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Ambil nilai dari cache.
   * @param {string} key
   * @returns {any|undefined} - undefined jika tidak ada atau sudah expired
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Hapus satu entri (mis. setelah data diubah).
   * @param {string} key
   */
  del(key) {
    this._store.delete(key);
  }

  /**
   * Hapus semua entri yang kuncinya cocok dengan prefix.
   * Berguna untuk invalidate semua cache milik satu user.
   * @param {string} prefix
   */
  delByPrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
      }
    }
  }

  /**
   * Hapus semua entri yang sudah expired.
   * Dipanggil otomatis setiap 5 menit, tapi bisa dipanggil manual juga.
   */
  _evict() {
    const now = Date.now();
    for (const [key, entry] of this._store.entries()) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }

  /**
   * Cache-aside helper — ambil dari cache, jika miss panggil loader lalu simpan.
   * @param {string} key
   * @param {() => Promise<any>} loader - Fungsi untuk fetch data jika cache miss
   * @param {number} ttlMs
   * @returns {Promise<any>}
   */
  async getOrSet(key, loader, ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const value = await loader();
    if (value !== undefined && value !== null) {
      this.set(key, value, ttlMs);
    }
    return value;
  }

  /** Jumlah entri yang aktif di cache (untuk debugging). */
  get size() {
    this._evict();
    return this._store.size;
  }
}

// Singleton — satu instance untuk seluruh proses
export const cache = new TTLCache();
