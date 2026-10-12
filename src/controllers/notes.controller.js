import { NotesService } from '../services/notes.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const svc = new NotesService();

const handleError = (res, next, err) => {
  if (err.message === 'NOTE_NOT_FOUND') return sendError(res, 'NOTE_NOT_FOUND', 'Catatan tidak ditemukan', 404);
  if (err.message === 'FORBIDDEN')      return sendError(res, 'FORBIDDEN', 'Akses ditolak', 403);
  next(err);
};

// GET /api/notes?page=1&limit=20
export const listNotes = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await svc.listNotes(req.user.id, { page, limit });
    return sendSuccess(res, result);
  } catch (e) { next(e); }
};

// GET /api/notes/:id
export const getNote = async (req, res, next) => {
  try {
    const note = await svc.getNote(req.user.id, Number(req.params.id));
    return sendSuccess(res, note);
  } catch (e) { handleError(res, next, e); }
};

// POST /api/notes
export const createNote = async (req, res, next) => {
  try {
    const note = await svc.createNote(req.user.id, req.body);
    return sendSuccess(res, note, null, 201);
  } catch (e) { next(e); }
};

// PATCH /api/notes/:id
export const updateNote = async (req, res, next) => {
  try {
    const note = await svc.updateNote(req.user.id, Number(req.params.id), req.body);
    return sendSuccess(res, note);
  } catch (e) { handleError(res, next, e); }
};

// DELETE /api/notes/:id
export const deleteNote = async (req, res, next) => {
  try {
    const deleted = await svc.deleteNote(req.user.id, Number(req.params.id));
    return sendSuccess(res, deleted, 'Catatan dihapus');
  } catch (e) { handleError(res, next, e); }
};
