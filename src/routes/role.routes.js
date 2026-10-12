import express from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();
const userController = new UserController();

// GET /api/roles — semua user login bisa lihat daftar role
router.get('/', authenticate, userController.listRoles);

export default router;
