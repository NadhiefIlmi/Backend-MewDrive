import express from 'express';
import { FileController } from '../controllers/file.controller.js';
import { uploadFile } from '../controllers/upload.controller.js';
import { downloadFile } from '../controllers/download.controller.js';
import { previewFile } from '../controllers/preview.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { upload, handleUploadError, validateMagicBytesMiddleware } from '../middleware/upload.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validator.js';
import { updateFileValidator, moveFileValidator } from '../validators/file.validator.js';

const router = express.Router();
const ctrl   = new FileController();

router.use(authenticate);

router.get('/',                    ctrl.list);
router.get('/starred',             ctrl.listStarred);
router.get('/trash',               ctrl.listTrash);
router.post('/trash/bulk-restore', ctrl.bulkRestore);
router.delete('/trash/empty',      ctrl.emptyTrash);
router.get('/recent',              ctrl.listRecent);

router.post('/upload', uploadRateLimiter, upload.single('file'), handleUploadError, validateMagicBytesMiddleware, uploadFile);

router.get('/:id',              ctrl.get);
router.get('/:id/download',     downloadFile);
router.get('/:id/preview',      previewFile);
router.patch('/:id',            updateFileValidator, validate, ctrl.update);
router.patch('/:id/move',       moveFileValidator,   validate, ctrl.move);
router.delete('/:id',           ctrl.trash);
router.post('/:id/restore',     ctrl.restore);
router.delete('/:id/permanent', ctrl.deletePermanent);

export default router;
