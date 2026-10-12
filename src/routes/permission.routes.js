import express from 'express';
import { PermissionController } from '../controllers/permission.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();
const permissionController = new PermissionController();

// GET /api/permissions — semua user login bisa lihat daftar permission
router.get('/', authenticate, permissionController.listPermissions);

// GET /api/users/:id/permissions — ADMIN atau user itu sendiri
router.get(
  '/users/:id/permissions',
  authenticate,
  permissionController.getUserPermissions
);

// PUT /api/users/:id/permissions — hanya ADMIN
router.put(
  '/users/:id/permissions',
  authenticate,
  requireRole('ADMIN'),
  permissionController.setUserPermissions
);

export default router;
