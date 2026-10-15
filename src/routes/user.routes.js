import express from 'express';
import { UserController } from '../controllers/user.controller.js';
import { PermissionController } from '../controllers/permission.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { sendError } from '../utils/response.js';
import { validate } from '../middleware/validator.js';
import {
  listUsersValidator,
  createUserValidator,
  updateUserValidator,
  updateStatusValidator,
  updateStorageQuotaValidator,
  resetPasswordValidator,
  changePasswordValidator,
} from '../validators/user.validator.js';

const router = express.Router();
const userController = new UserController();
const permissionController = new PermissionController();

// ─── Route publik (hanya butuh login, tidak harus ADMIN) ─────────────────────

/**
 * PATCH /api/users/me/password — user ganti password sendiri (butuh password lama)
 * Harus didefinisikan SEBELUM router.use(requireRole('ADMIN'))
 */
router.patch(
  '/me/password',
  authenticate,
  changePasswordValidator,
  validate,
  userController.changePassword
);

/**
 * GET /api/users/:id/permissions — user bisa lihat permission dirinya sendiri,
 * admin bisa lihat permission siapapun.
 */
router.get(
  '/:id/permissions',
  authenticate,
  (req, res, next) => {
    // Izinkan jika ADMIN atau user mengakses miliknya sendiri
    if (req.user.role === 'ADMIN' || String(req.user.id) === String(req.params.id)) {
      return next();
    }
    return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
  },
  permissionController.getUserPermissions
);

// ─── Semua route di bawah ini wajib login DAN harus ADMIN ────────────────────
router.use(authenticate, requireRole('ADMIN'));

/**
 * GET  /api/users              — list semua user (filter: status, role, search, page, limit)
 * POST /api/users              — buat user baru
 */
router
  .route('/')
  .get(listUsersValidator, validate, userController.listUsers)
  .post(createUserValidator, validate, userController.createUser);

/**
 * GET    /api/users/:id        — detail user
 * PATCH  /api/users/:id        — update name / email / role
 * DELETE /api/users/:id        — hapus user
 */
router
  .route('/:id')
  .get(userController.getUser)
  .patch(updateUserValidator, validate, userController.updateUser)
  .delete(userController.deleteUser);

/**
 * PATCH /api/users/:id/status          — enable / disable user
 * PATCH /api/users/:id/storage-quota   — update storage quota
 * POST  /api/users/:id/reset-password  — reset password user
 */
router.patch('/:id/status', updateStatusValidator, validate, userController.updateStatus);
router.patch('/:id/storage-quota', updateStorageQuotaValidator, validate, userController.updateStorageQuota);
router.post('/:id/reset-password', resetPasswordValidator, validate, userController.resetPassword);

export default router;
