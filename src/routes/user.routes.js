import express from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validator.js';
import {
  listUsersValidator,
  createUserValidator,
  updateUserValidator,
  updateStatusValidator,
  updateStorageQuotaValidator,
  resetPasswordValidator,
} from '../validators/user.validator.js';

const router = express.Router();
const userController = new UserController();

// Semua route users wajib login dan harus ADMIN
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
