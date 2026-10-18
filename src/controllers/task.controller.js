import { TaskService } from '../services/task.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const svc = new TaskService();

const handleError = (res, next, err) => {
  if (err.message === 'TASK_NOT_FOUND') return sendError(res, 'TASK_NOT_FOUND', 'Task tidak ditemukan', 404);
  if (err.message === 'FORBIDDEN')      return sendError(res, 'FORBIDDEN', 'Akses ditolak', 403);
  if (err.message === 'FILE_NOT_FOUND') return sendError(res, 'FILE_NOT_FOUND', 'File tidak ditemukan', 404);
  next(err);
};

/**
 * Parse ID dari URL param — return null jika tidak valid atau out of range.
 * Mencegah "invalid input syntax for type integer: NaN" dan
 * "value out of range for type integer" dari PostgreSQL (→ 400 bukan 500).
 * PostgreSQL INTEGER max = 2147483647
 */
const parseId = (raw) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) return null;
  return n;
};

// GET /api/tasks
export const listTasks = async (req, res, next) => {
  try {
    const { status, priority, page, limit } = req.query;
    const result = await svc.listTasks(req.user.id, { status, priority, page, limit });
    return sendSuccess(res, result);
  } catch (e) { next(e); }
};

// GET /api/tasks/:id
export const getTask = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const task = await svc.getTask(req.user.id, id);
    return sendSuccess(res, task);
  } catch (e) { handleError(res, next, e); }
};

// POST /api/tasks
export const createTask = async (req, res, next) => {
  try {
    const task = await svc.createTask(req.user.id, req.body);
    return sendSuccess(res, task, null, 201);
  } catch (e) { next(e); }
};

// PATCH /api/tasks/:id
export const updateTask = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const task = await svc.updateTask(req.user.id, id, req.body);
    return sendSuccess(res, task);
  } catch (e) { handleError(res, next, e); }
};

// DELETE /api/tasks/:id
export const deleteTask = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const deleted = await svc.deleteTask(req.user.id, id, req);
    return sendSuccess(res, deleted, 'Task dihapus');
  } catch (e) { handleError(res, next, e); }
};

// PATCH /api/tasks/:id/status — shortcut drag-and-drop
export const moveTaskStatus = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const { status, position } = req.body;
    const task = await svc.updateTask(req.user.id, id, { status, position });
    return sendSuccess(res, task);
  } catch (e) { handleError(res, next, e); }
};

// POST /api/tasks/:id/files
export const attachFile = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const files = await svc.attachFile(req.user.id, id, Number(req.body.file_id));
    return sendSuccess(res, files);
  } catch (e) { handleError(res, next, e); }
};

// DELETE /api/tasks/:id/files/:fileId
export const detachFile = async (req, res, next) => {
  const id     = parseId(req.params.id);
  const fileId = parseId(req.params.fileId);
  if (!id || !fileId) return sendError(res, 'INVALID_ID', 'ID tidak valid', 400);
  try {
    const result = await svc.detachFile(req.user.id, id, fileId);
    return sendSuccess(res, result);
  } catch (e) { handleError(res, next, e); }
};
