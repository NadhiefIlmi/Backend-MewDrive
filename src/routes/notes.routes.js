import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validator.js';
import {
  createNoteValidator,
  updateNoteValidator,
  listNotesValidator,
} from '../validators/notes.validator.js';
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../controllers/notes.controller.js';

const router = express.Router();

// Semua endpoint butuh login
router.use(authenticate);

router.get('/',       requirePermission('view_files'),    listNotesValidator,  validate, listNotes);
router.post('/',      requirePermission('create_files'),  createNoteValidator, validate, createNote);
router.get('/:id',    requirePermission('view_files'),    getNote);
router.patch('/:id',  requirePermission('edit_files'),    updateNoteValidator, validate, updateNote);
router.delete('/:id', requirePermission('delete_files'),  deleteNote);

export default router;
