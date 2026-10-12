import { FolderService } from '../services/folder.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const folderService = new FolderService();

// Helper: map error message → HTTP response
const handleError = (res, error, next) => {
  const map = {
    FOLDER_NOT_FOUND:        ['FOLDER_NOT_FOUND',        'Folder not found',                                   404],
    FOLDER_NAME_REQUIRED:    ['VALIDATION_ERROR',         'Folder name is required',                            400],
    FOLDER_NAME_TOO_LONG:    ['VALIDATION_ERROR',         'Folder name must be 255 characters or less',         400],
    FOLDER_NAME_EXISTS:      ['FOLDER_NAME_EXISTS',       'A folder with that name already exists',             409],
    PARENT_FOLDER_NOT_FOUND: ['FOLDER_NOT_FOUND',         'Parent folder not found',                            404],
    PARENT_FOLDER_TRASHED:   ['PARENT_FOLDER_TRASHED',    'Cannot create folder inside a trashed folder',       400],
    FOLDER_TRASHED:          ['FOLDER_TRASHED',           'Folder is in trash',                                 400],
    FOLDER_ALREADY_TRASHED:  ['FOLDER_ALREADY_TRASHED',   'Folder is already in trash',                         400],
    FOLDER_NOT_TRASHED:      ['FOLDER_NOT_TRASHED',       'Folder is not in trash',                             400],
    CANNOT_MOVE_INTO_SELF:   ['VALIDATION_ERROR',         'Cannot move a folder into itself',                   400],
    TARGET_FOLDER_NOT_FOUND: ['FOLDER_NOT_FOUND',         'Target folder not found',                            404],
    TARGET_FOLDER_TRASHED:   ['TARGET_FOLDER_TRASHED',    'Target folder is in trash',                          400],
    CIRCULAR_REFERENCE:      ['CIRCULAR_REFERENCE',       'Cannot move a folder into its own subfolder',        400],
  };
  const entry = map[error.message];
  if (entry) return sendError(res, entry[0], entry[1], entry[2]);
  next(error);
};

export class FolderController {

  // POST /api/folders/trash/bulk-restore
  bulkRestore = async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
      if (ids.length === 0) {
        return sendError(res, 'VALIDATION_ERROR', 'ids array is required', 400);
      }
      const result = await folderService.bulkRestoreFolders(req.user.id, ids);
      return sendSuccess(res, result, `${result.restored.length} folder(s) restored`);
    } catch (e) { next(e); }
  };

  // GET /api/folders/starred
  listStarred = async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const result = await folderService.listStarredFolders(req.user.id, { page, limit });
      return sendSuccess(res, result);
    } catch (e) { next(e); }
  };

  // GET /api/folders?parent_id=...&page=1&limit=50
  list = async (req, res, next) => {
    try {
      const parentId = req.query.parent_id ? Number(req.query.parent_id) : null;
      const page     = Math.max(1, Number(req.query.page ?? 1));
      const limit    = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const result   = await folderService.listFolders(req.user.id, parentId, { page, limit });
      return sendSuccess(res, result);
    } catch (e) { handleError(res, e, next); }
  };

  // GET /api/folders/trash?page=1&limit=50
  listTrash = async (req, res, next) => {
    try {
      const page  = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(Math.max(1, Number(req.query.limit ?? 50)), 100);
      const offset = (page - 1) * limit;
      const { FolderRepository } = await import('../repositories/folder.repository.js');
      const repo   = new FolderRepository();
      const result = await repo.findTrashedByUser(req.user.id, { limit, offset });
      return sendSuccess(res, result);
    } catch (e) { next(e); }
  };

  // GET /api/folders/:id
  get = async (req, res, next) => {
    try {
      const isAdmin = req.user.role === 'ADMIN';
      const folder  = await folderService.getFolder(req.user.id, Number(req.params.id), isAdmin);
      return sendSuccess(res, folder);
    } catch (e) { handleError(res, e, next); }
  };

  // POST /api/folders
  create = async (req, res, next) => {
    try {
      const { name, parent_id, color, icon } = req.body;
      const folder = await folderService.createFolder(req.user.id, {
        name,
        parentId: parent_id ? Number(parent_id) : null,
        color,
        icon,
      });
      return sendSuccess(res, folder, 'Folder created successfully', 201);
    } catch (e) { handleError(res, e, next); }
  };

  // PATCH /api/folders/:id
  update = async (req, res, next) => {
    try {
      const { name, color, icon, is_starred } = req.body;
      const folder = await folderService.updateFolder(
        req.user.id, Number(req.params.id), { name, color, icon, is_starred }
      );
      return sendSuccess(res, folder, 'Folder updated successfully');
    } catch (e) { handleError(res, e, next); }
  };

  // DELETE /api/folders/:id  (soft-delete → trash)
  trash = async (req, res, next) => {
    try {
      const folder = await folderService.trashFolder(req.user.id, Number(req.params.id));
      return sendSuccess(res, folder, 'Folder moved to trash');
    } catch (e) { handleError(res, e, next); }
  };

  // POST /api/folders/:id/restore
  restore = async (req, res, next) => {
    try {
      const folder = await folderService.restoreFolder(req.user.id, Number(req.params.id));
      return sendSuccess(res, folder, 'Folder restored');
    } catch (e) { handleError(res, e, next); }
  };

  // DELETE /api/folders/:id/permanent
  deletePermanent = async (req, res, next) => {
    try {
      const isAdmin = req.user.role === 'ADMIN';
      const result  = await folderService.deletePermanent(req.user.id, Number(req.params.id), isAdmin);
      return sendSuccess(res, result, 'Folder permanently deleted');
    } catch (e) { handleError(res, e, next); }
  };

  // PATCH /api/folders/:id/move
  move = async (req, res, next) => {
    try {
      const raw            = req.body.target_parent_id;
      const targetParentId = raw !== undefined && raw !== null ? Number(raw) : null;
      const folder = await folderService.moveFolder(
        req.user.id,
        Number(req.params.id),
        targetParentId,
      );
      return sendSuccess(res, folder, 'Folder moved successfully');
    } catch (e) { handleError(res, e, next); }
  };
}
