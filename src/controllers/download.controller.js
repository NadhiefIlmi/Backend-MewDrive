import fs from 'fs';
import { FileRepository } from '../repositories/file.repository.js';
import { sendError } from '../utils/response.js';
import { cache } from '../utils/cache.js';
import { config } from '../config/env.js';

const fileRepo = new FileRepository();

// Prefix cache key per file
const FILE_CACHE_KEY = (id) => `file:${id}`;

/**
 * GET /api/files/:id/download
 *
 * Stream file ke client sebagai attachment (force download).
 * Mendukung HTTP Range requests (RFC 7233) untuk:
 * - Resume download yang terputus
 * - Partial content (diperlukan beberapa download manager)
 * - ETag untuk conditional GET (skip download jika file belum berubah)
 */
export const downloadFile = async (req, res, next) => {
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

    // ─── 3. Jangan izinkan download file yang di-trash ──────────────────────
    if (file.is_trashed) {
      return sendError(res, 'FILE_TRASHED', 'File is in trash', 400);
    }

    // ─── 4. Pastikan file fisik ada (async, non-blocking) ───────────────────
    const filePath = file.storage_path;
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return sendError(res, 'FILE_NOT_FOUND', 'File data not found on server', 404);
    }

    // ─── 5. ETag & conditional GET ──────────────────────────────────────────
    // ETag dibuat dari id file + updated_at — unik per versi file.
    // Jika client sudah punya versi yang sama (If-None-Match), skip download.
    const etag = `"${fileId}-${new Date(file.updated_at).getTime()}"`;
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    const fileSize = file.size;

    // ─── 6. Parse Range header ──────────────────────────────────────────────
    const rangeHeader = req.headers['range'];

    if (rangeHeader) {
      // Format: "bytes=start-end" (end bisa kosong = sampai akhir file)
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end(); // Range Not Satisfiable
      }

      let start = match[1] !== '' ? parseInt(match[1], 10) : null;
      let end   = match[2] !== '' ? parseInt(match[2], 10) : null;

      // "bytes=-500" → last 500 bytes
      if (start === null && end !== null) {
        start = Math.max(0, fileSize - end);
        end   = fileSize - 1;
      } else {
        start = start ?? 0;
        end   = end   ?? fileSize - 1;
      }

      // Validasi range
      if (start < 0 || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      const encodedName = encodeURIComponent(file.name);

      res.setHeader('Content-Range',       `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges',       'bytes');
      res.setHeader('Content-Length',      chunkSize);
      res.setHeader('Content-Type',        file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control',       'private, no-cache');
      res.setHeader('ETag',                etag);
      res.status(206); // Partial Content

      const readStream = fs.createReadStream(filePath, { start, end });
      readStream.on('error', (err) => {
        console.error('Download range stream error:', err);
        if (!res.headersSent) sendError(res, 'STREAM_ERROR', 'Error reading file', 500);
      });
      readStream.pipe(res);

    } else {
      // ─── 7. Full download (no Range header) ─────────────────────────────
      const encodedName = encodeURIComponent(file.name);

      res.setHeader('Accept-Ranges',       'bytes');
      res.setHeader('Content-Length',      fileSize);
      res.setHeader('Content-Type',        file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Cache-Control',       'private, no-cache');
      res.setHeader('ETag',                etag);

      const readStream = fs.createReadStream(filePath);
      readStream.on('error', (err) => {
        console.error('Download stream error:', err);
        if (!res.headersSent) sendError(res, 'STREAM_ERROR', 'Error reading file', 500);
      });
      readStream.pipe(res);
    }

    // ─── 8. Touch last_accessed_at (fire-and-forget) ────────────────────────
    fileRepo.touchAccessed(fileId).catch(() => {});

  } catch (error) {
    next(error);
  }
};
