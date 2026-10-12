import { ShareService } from '../services/share.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import fs from 'fs';

const svc = new ShareService();

const handleError = (res, next, err) => {
  const map = {
    FILE_NOT_FOUND:        ['FILE_NOT_FOUND',        'File tidak ditemukan',                     404],
    FORBIDDEN:             ['FORBIDDEN',              'Akses ditolak',                           403],
    FILE_TRASHED:          ['FILE_TRASHED',           'File sudah dihapus',                      410],
    INVALID_EXPIRES_AT:    ['INVALID_EXPIRES_AT',     'Tanggal kadaluarsa tidak valid atau sudah lewat', 400],
    SHARE_LINK_NOT_FOUND:  ['SHARE_LINK_NOT_FOUND',  'Share link tidak ditemukan',               404],
    SHARE_LINK_INACTIVE:   ['SHARE_LINK_INACTIVE',   'Share link tidak aktif',                  410],
    SHARE_LINK_EXPIRED:    ['SHARE_LINK_EXPIRED',     'Share link sudah kadaluarsa',             410],
  };
  const entry = map[err.message];
  if (entry) return sendError(res, entry[0], entry[1], entry[2]);
  next(err);
};

// POST /api/share
// Body: { file_id, expires_at? }
export const createShareLink = async (req, res, next) => {
  try {
    const { file_id, expires_at } = req.body;
    if (!file_id || isNaN(Number(file_id))) {
      return sendError(res, 'VALIDATION_ERROR', 'file_id harus diisi dan berupa angka', 400);
    }
    const link = await svc.createShareLink(req.user.id, Number(file_id), expires_at ?? null);
    return sendSuccess(res, link, null, 201);
  } catch (e) { handleError(res, next, e); }
};

// GET /api/share
// Semua share link milik user yang sedang login
export const listShareLinks = async (req, res, next) => {
  try {
    const links = await svc.listShareLinks(req.user.id);
    return sendSuccess(res, links);
  } catch (e) { next(e); }
};

// PATCH /api/share/:id/toggle
// Body: { is_active: boolean }
export const toggleShareLink = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return sendError(res, 'VALIDATION_ERROR', 'is_active harus berupa boolean', 400);
    }
    const link = await svc.toggleShareLink(req.user.id, Number(req.params.id), is_active);
    return sendSuccess(res, link);
  } catch (e) { handleError(res, next, e); }
};

// DELETE /api/share/:id
export const deleteShareLink = async (req, res, next) => {
  try {
    const deleted = await svc.deleteShareLink(req.user.id, Number(req.params.id));
    return sendSuccess(res, deleted, 'Share link dihapus');
  } catch (e) { handleError(res, next, e); }
};

// ─── Public endpoints (tanpa auth) ────────────────────────────────────────────

// GET /api/public/share/:token
// Resolve token → return metadata file
export const getPublicShareInfo = async (req, res, next) => {
  try {
    const link = await svc.resolveToken(req.params.token);
    return sendSuccess(res, {
      token:       link.token,
      file_id:     link.file_id,
      name:        link.name,
      original_name: link.original_name,
      mime_type:   link.mime_type,
      extension:   link.extension,
      size:        link.size,
      expires_at:  link.expires_at,
    });
  } catch (e) { handleError(res, next, e); }
};

// GET /api/public/share/:token/preview
// Inline preview via share token — tidak butuh JWT
export const publicPreview = async (req, res, next) => {
  try {
    const link = await svc.resolveToken(req.params.token);

    const PREVIEWABLE = [
      'image/', 'video/', 'audio/',
      'application/pdf',
      'text/plain', 'text/csv', 'text/html',
      'application/json', 'application/xml',
    ];
    const isPreviewable = PREVIEWABLE.some(p => link.mime_type.startsWith(p));
    if (!isPreviewable) {
      return res.json({ success: true, data: { previewable: false, name: link.name } });
    }

    const filePath = link.storage_path;
    if (!fs.existsSync(filePath)) {
      return sendError(res, 'FILE_NOT_FOUND', 'File fisik tidak ditemukan', 404);
    }

    res.set({
      'Content-Type':        link.mime_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(link.name)}"`,
      'Cache-Control':       'public, max-age=300',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) { handleError(res, next, e); }
};

// GET /api/public/share/:token/download
// Force-download via share token — tidak butuh JWT
export const publicDownload = async (req, res, next) => {
  try {
    const link = await svc.resolveToken(req.params.token);

    const filePath = link.storage_path;
    if (!fs.existsSync(filePath)) {
      return sendError(res, 'FILE_NOT_FOUND', 'File fisik tidak ditemukan', 404);
    }

    res.set({
      'Content-Type':        link.mime_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(link.name)}"`,
      'Content-Length':      link.size,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) { handleError(res, next, e); }
};
