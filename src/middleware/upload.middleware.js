import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root storage directory — relatif dari backend root (bukan src/middleware)
const STORAGE_ROOT = path.join(__dirname, '../../storage/uploads');

// ─── File size limit ──────────────────────────────────────────────────────────
// Max 15 MB per file
const MAX_FILE_SIZE = 15 * 1024 * 1024;

// ─── MIME type allowlist ──────────────────────────────────────────────────────
// SVG dan HTML SENGAJA dihapus dari allowlist:
//   - SVG  bisa berisi <script> embedded → XSS vector
//   - HTML bisa berisi <script>, form hijacking → stored XSS
// Kalau perlu SVG nanti, serve harus pakai Content-Type: text/plain + nosniff header.
const ALLOWED_MIME_TYPES = new Set([
  // Images (raster saja, bukan SVG)
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text (plain saja)
  'text/plain', 'text/csv', 'text/markdown',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/x-tar', 'application/gzip',
  // Data (JSON + XML tetap ada — useful, tapi di-sanitize nama file)
  'application/json', 'application/xml',
]);

// ─── Magic bytes map ──────────────────────────────────────────────────────────
// Format: { mimeType → { offset, bytes[] } }
// offset = posisi byte pertama yang dicek (biasanya 0)
// bytes  = array nilai byte (number) yang harus cocok
//
// Tujuan: mencegah attacker upload file berbahaya dengan Content-Type palsu.
// Contoh: upload PHP file dengan Content-Type: image/jpeg → ditolak di sini.
const MAGIC_BYTES = {
  'image/jpeg':  { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  'image/png':   { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  'image/gif':   { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  'image/webp':  { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP" di offset 8
  'application/pdf':    { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  'application/zip':    { offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK
  'application/gzip':   { offset: 0, bytes: [0x1F, 0x8B] },
};

// Tipe yang tidak punya tanda magic bytes jelas (text-based) — skip pengecekan bytes
const MAGIC_SKIP_TYPES = new Set([
  'text/plain', 'text/csv', 'text/markdown',
  'application/json', 'application/xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
]);

/**
 * Baca sejumlah byte dari file menggunakan file descriptor.
 * Dipakai untuk validasi magic bytes setelah file ditulis ke disk.
 *
 * @param   {string} filePath - Path file di disk
 * @param   {number} length   - Jumlah byte yang dibaca (default 12)
 * @returns {Buffer}
 */
function readFileHeader(filePath, length = 12) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, 0);
    return buf;
  } catch {
    return Buffer.alloc(0);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Validasi magic bytes file — cocokkan header file fisik dengan mime type.
 *
 * @param   {string} filePath - Path file di disk
 * @param   {string} mimeType - MIME type yang diklaim client
 * @returns {boolean} true jika valid atau tipe tidak punya magic bytes
 */
function validateMagicBytes(filePath, mimeType) {
  // Tipe text-based tidak punya magic bytes yang bisa dicek — lewati
  if (MAGIC_SKIP_TYPES.has(mimeType)) return true;

  const rule = MAGIC_BYTES[mimeType];
  if (!rule) return true; // Tidak ada rule → beri benefit of doubt

  const header = readFileHeader(filePath, rule.offset + rule.bytes.length);
  if (header.length < rule.offset + rule.bytes.length) return false;

  return rule.bytes.every((byte, i) => header[rule.offset + i] === byte);
}

// ─── Multer storage engine ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.user?.id;
    if (!userId) return cb(new Error('UNAUTHENTICATED'), '');

    const userDir = path.join(STORAGE_ROOT, String(userId));
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    // Sanitasi nama file:
    //  1. Ambil ekstensi original
    //  2. Ganti karakter non-aman dengan underscore
    //  3. Batasi panjang 100 karakter
    //  4. Tambah timestamp untuk keunikan
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .slice(0, 100);
    const unique = `${base}_${Date.now()}${ext}`;
    cb(null, unique);
  },
});

// ─── File filter (MIME check — fase 1) ────────────────────────────────────────
// Fase 1: cek MIME type dari header HTTP (cepat, tapi bisa dipalsukan)
// Fase 2: cek magic bytes setelah file tersimpan — dilakukan di validateUpload()
const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`FILE_TYPE_NOT_ALLOWED:${file.mimetype}`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// ─── Magic bytes validator (fase 2) ───────────────────────────────────────────
/**
 * Middleware pasca-upload: validasi magic bytes file yang sudah tersimpan ke disk.
 * Harus dipasang SETELAH upload.single() dan handleUploadError.
 *
 * Jika tidak valid → hapus file dari disk, kirim 400.
 */
export const validateMagicBytesMiddleware = (req, res, next) => {
  const file = req.file;
  if (!file) return next(); // Tidak ada file → biarkan controller handle

  const isValid = validateMagicBytes(file.path, file.mimetype);

  if (!isValid) {
    // Hapus file yang sudah terlanjur disimpan
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }

    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_TYPE_MISMATCH',
        message: 'File content does not match the declared file type',
      },
    });
  }

  next();
};

// ─── Error handler untuk multer errors ────────────────────────────────────────
export const handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds the 15 MB limit' },
    });
  }

  if (err.message?.startsWith('FILE_TYPE_NOT_ALLOWED')) {
    const mime = err.message.split(':')[1] ?? '';
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_TYPE_NOT_ALLOWED', message: `File type not allowed: ${mime}` },
    });
  }

  next(err);
};
