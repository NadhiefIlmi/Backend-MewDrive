import fs from 'fs';
import { FileRepository } from '../repositories/file.repository.js';
import { sendError } from '../utils/response.js';
import { cache } from '../utils/cache.js';
import { config } from '../config/env.js';

const fileRepo = new FileRepository();

// Prefix cache key per file
const FILE_CACHE_KEY = (id) => `file:${id}`;

// MIME types yang bisa di-preview langsung di browser
const PREVIEWABLE_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // PDF
  'application/pdf',
  // Text / Code
  'text/plain', 'text/csv', 'text/html', 'text/markdown',
  'application/json', 'application/xml',
]);

/**
 * GET /api/files/:id/preview
 *
 * Serve file dengan Content-Disposition: inline (buka di browser, bukan download).
 * Untuk tipe file yang tidak bisa di-preview, return metadata saja.
 * Mendukung HTTP Range untuk video/audio seek dan PDF lazy-load oleh browser.
 */
export const previewFile = async (req, res, next) => {
  try {
    const fileId  = Number(req.params.id);
    const userId  = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    // ─── 1. Ambil metadata (cache-aside) ────────────────────────────────────
    const file = await cache.getOrSet(
      FILE_CACHE_KEY(fileId),
      () => fileRepo.findById(fileId),
      config.cache.fileTtlMs
    );

    if (!file) {
      return sendError(res, 'FILE_NOT_FOUND', 'File not found', 404);
    }

    // ─── 2. Ownership check ─────────────────────────────────────────────────
    if (!isAdmin && file.user_id !== userId) {
      return sendError(res, 'FILE_NOT_FOUND', 'File not found', 404);
    }

    // ─── 3. Tidak izinkan preview file trashed ──────────────────────────────
    if (file.is_trashed) {
      return sendError(res, 'FILE_TRASHED', 'File is in trash', 400);
    }

    // ─── 4. Tipe tidak bisa di-preview → return metadata ───────────────────
    if (!PREVIEWABLE_TYPES.has(file.mime_type)) {
      return res.json({
        success: true,
        data: {
          previewable: false,
          id: file.id,
          name: file.name,
          original_name: file.original_name,
          mime_type: file.mime_type,
          extension: file.extension,
          size: file.size,
        },
      });
    }

    // ─── 5. Pastikan file fisik ada (async) ─────────────────────────────────
    const filePath = file.storage_path;
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return sendError(res, 'FILE_NOT_FOUND', 'File data not found on server', 404);
    }

    // ─── 6. ETag & conditional GET ──────────────────────────────────────────
    const etag = `"${fileId}-${new Date(file.updated_at).getTime()}"`;
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    const fileSize = file.size;

    // ─── 7. Parse Range header (diperlukan untuk video/audio, PDF multi-page) ──
    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      let start = match[1] !== '' ? parseInt(match[1], 10) : null;
      let end   = match[2] !== '' ? parseInt(match[2], 10) : null;

      if (start === null && end !== null) {
        start = Math.max(0, fileSize - end);
        end   = fileSize - 1;
      } else {
        start = start ?? 0;
        end   = end   ?? fileSize - 1;
      }

      if (start < 0 || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      const encodedName = encodeURIComponent(file.original_name);

      res.setHeader('Content-Range',       `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges',       'bytes');
      res.setHeader('Content-Length',      chunkSize);
      res.setHeader('Content-Type',        file.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control',       'private, max-age=300'); // 5 menit
      res.setHeader('ETag',                etag);
      res.setHeader('X-Frame-Options',     'ALLOWALL');           // allow PDF iframe
      res.setHeader('Access-Control-Allow-Origin',    '*');
      res.setHeader('Cross-Origin-Resource-Policy',   'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy',   'unsafe-none');
      res.status(206); // Partial Content

      const readStream = fs.createReadStream(filePath, { start, end });
      readStream.on('error', (err) => {
        console.error('Preview range stream error:', err);
        if (!res.headersSent) sendError(res, 'STREAM_ERROR', 'Error reading file', 500);
      });
      readStream.pipe(res);

    } else {
      // ─── 8. Full file (no Range header) ─────────────────────────────────
      const encodedName = encodeURIComponent(file.original_name);

      res.setHeader('Accept-Ranges',       'bytes');
      res.setHeader('Content-Length',      fileSize);
      res.setHeader('Content-Type',        file.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control',       'private, max-age=300');
      res.setHeader('ETag',                etag);
      res.setHeader('X-Frame-Options',     'ALLOWALL');
      res.setHeader('Access-Control-Allow-Origin',    '*');
      res.setHeader('Cross-Origin-Resource-Policy',   'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy',   'unsafe-none');

      const readStream = fs.createReadStream(filePath);
      readStream.on('error', (err) => {
        console.error('Preview stream error:', err);
        if (!res.headersSent) sendError(res, 'STREAM_ERROR', 'Error reading file', 500);
      });
      readStream.pipe(res);
    }

    // ─── 9. Touch last_accessed_at (fire-and-forget) ────────────────────────
    fileRepo.touchAccessed(fileId).catch(() => {});

  } catch (error) {
    next(error);
  }
};
