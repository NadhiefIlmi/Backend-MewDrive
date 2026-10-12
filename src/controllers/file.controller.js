import { FileService } from '../services/file.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { cache } from '../utils/cache.js';

const FILE_CACHE_KEY = (id) => `file:${id}`;

const fileService = new FileService();

const handleError = (res, error, next) => {
  const map = {
    FILE_NOT_FOUND:          ['FILE_NOT_FOUND',          'File not found',                              404],
    FILE_NAME_REQUIRED:      ['VALIDATION_ERROR',         'File name is required',                       400],
    FILE_NAME_TOO_LONG:      ['VALIDATION_ERROR',         'File name must be 255 characters or less',    400],
    FILE_NAME_EXISTS:        ['FILE_NAME_EXISTS',         'A file with that name already exists',        409],
    FILE_TRASHED:            ['FILE_TRASHED',             'File is in trash',                            400],
    FILE_ALREADY_TRASHED:    ['FILE_ALREADY_TRASHED',     'File is already in trash',                    400],
    FILE_NOT_TRASHED:        ['FILE_NOT_TRASHED',         'File is not in trash',                        400],
    FOLDER_NOT_FOUND:        ['FOLDER_NOT_FOUND',         'Folder not found',                            404],
    TARGET_FOLDER_NOT_FOUND: ['FOLDER_NOT_FOUND',         'Target folder not found',                     404],
    TARGET_FOLDER_TRASHED:   ['TARGET_FOLDER_TRASHED',    'Target folder is in trash',                   400],
  };
  const entry = map[error.message];
  if (entry) return sendError(res, entry[0], entry[1], entry[2]);
  next(error);
};

export class FileController {

  // POST /api/files/trash/bulk-restore
  bulkRestore = async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
      if (ids.length === 0) {
        return sendError(res, 'VALIDATION_ERROR', 'ids array is required', 400);
      }
      const result = await fileService.bulkRestoreFiles(req.user.id, ids);
      return sendSuccess(res, result, `${result.restored.length} file(s) restored`);
    } catch (e) { next(e); }
  };

  // GET /api/files/starred
  listStarred = async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const result = await fileService.listStarredFiles(req.user.id, { page, limit });
      return sendSuccess(res, result);
    } catch (e) { next(e); }
  };

  // GET /api/files/recent?limit=N
  listRecent = async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20), 50);
      const files = await fileService.listRecentFiles(req.user.id, limit);
      return sendSuccess(res, files);
    } catch (e) { next(e); }
  };

  // GET /api/files?folder_id=...&page=1&limit=50
  list = async (req, res, next) => {
    try {
      const folderId = req.query.folder_id ? Number(req.query.folder_id) : null;
      const page     = Math.max(1, Number(req.query.page ?? 1));
      const limit    = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const result   = await fileService.listFiles(req.user.id, folderId, { page, limit });
      return sendSuccess(res, result);
    } catch (e) { handleError(res, e, next); }
  };

  // GET /api/files/trash?page=1&limit=50
  listTrash = async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const offset = (page - 1) * limit;
      const { FileRepository } = await import('../repositories/file.repository.js');
      const repo   = new FileRepository();
      const result = await repo.findTrashedByUser(req.user.id, { limit, offset });
      return sendSuccess(res, result);
    } catch (e) { next(e); }
  };

  // GET /api/files/:id
  get = async (req, res, next) => {
    try {
      const isAdmin = req.user.role === 'ADMIN';
      const file    = await fileService.getFile(req.user.id, Number(req.params.id), isAdmin);
      return sendSuccess(res, file);
    } catch (e) { handleError(res, e, next); }
  };

  // PATCH /api/files/:id  — rename
  update = async (req, res, next) => {
    try {
      const { name, is_starred } = req.body;
      let file;
      if (name !== undefined) {
        file = await fileService.renameFile(req.user.id, Number(req.params.id), name);
      } else if (is_starred !== undefined) {
        file = await fileService.toggleStar(req.user.id, Number(req.params.id));
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'Nothing to update', 400);
      }
      cache.del(FILE_CACHE_KEY(Number(req.params.id)));
      return sendSuccess(res, file, 'File updated successfully');
    } catch (e) { handleError(res, e, next); }
  };

  // DELETE /api/files/:id  (soft-delete → trash)
  trash = async (req, res, next) => {
    try {
      const file = await fileService.trashFile(req.user.id, Number(req.params.id));
      cache.del(FILE_CACHE_KEY(Number(req.params.id)));
      return sendSuccess(res, file, 'File moved to trash');
    } catch (e) { handleError(res, e, next); }
  };

  // POST /api/files/:id/restore
  restore = async (req, res, next) => {
    try {
      const file = await fileService.restoreFile(req.user.id, Number(req.params.id));
      cache.del(FILE_CACHE_KEY(Number(req.params.id)));
      return sendSuccess(res, file, 'File restored');
    } catch (e) { handleError(res, e, next); }
  };

  // DELETE /api/files/:id/permanent
  deletePermanent = async (req, res, next) => {
    try {
      const isAdmin = req.user.role === 'ADMIN';
      const result  = await fileService.deletePermanent(req.user.id, Number(req.params.id), isAdmin);
      cache.del(FILE_CACHE_KEY(Number(req.params.id)));
      cache.del(`storage:${req.user.id}`); // storage quota berubah
      return sendSuccess(res, result, 'File permanently deleted');
    } catch (e) { handleError(res, e, next); }
  };

  // DELETE /api/files/trash/empty  — kosongkan sampah
  emptyTrash = async (req, res, next) => {
    try {
      const result = await fileService.emptyTrash(req.user.id);
      // Invalidate cache semua file milik user ini
      cache.delByPrefix('file:');
      cache.del(`storage:${req.user.id}`); // storage quota berubah
      return sendSuccess(res, result, `Trash emptied: ${result.deleted} file(s) deleted`);
    } catch (e) { next(e); }
  };

  // PATCH /api/files/:id/move
  move = async (req, res, next) => {
    try {
      const raw            = req.body.target_folder_id;
      const targetFolderId = raw !== undefined && raw !== null ? Number(raw) : null;
      const file = await fileService.moveFile(
        req.user.id,
        Number(req.params.id),
        targetFolderId,
      );
      cache.del(FILE_CACHE_KEY(Number(req.params.id)));
      return sendSuccess(res, file, 'File moved successfully');
    } catch (e) { handleError(res, e, next); }
  };
}
