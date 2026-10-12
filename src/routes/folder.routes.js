import express from 'express';
import { FolderController } from '../controllers/folder.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validator.js';
import {
  createFolderValidator,
  updateFolderValidator,
  moveFolderValidator,
} from '../validators/folder.validator.js';

const router = express.Router();
const ctrl   = new FolderController();

// Semua route butuh login
router.use(authenticate);

router.get('/',                     requirePermission('view_files'),    ctrl.list);
router.get('/starred',              requirePermission('view_files'),    ctrl.listStarred);
router.get('/trash',                requirePermission('view_files'),    ctrl.listTrash);
router.post('/trash/bulk-restore',  requirePermission('delete_files'),  ctrl.bulkRestore);
router.get('/:id',                  requirePermission('view_files'),    ctrl.get);
router.post('/',                    requirePermission('create_files'),  createFolderValidator, validate, ctrl.create);
router.patch('/:id',                requirePermission('edit_files'),    updateFolderValidator, validate, ctrl.update);
router.patch('/:id/move',           requirePermission('edit_files'),    moveFolderValidator,   validate, ctrl.move);
router.delete('/:id',               requirePermission('delete_files'),  ctrl.trash);
router.post('/:id/restore',         requirePermission('delete_files'),  ctrl.restore);
router.delete('/:id/permanent',     requirePermission('delete_files'),  ctrl.deletePermanent);

export default router;
