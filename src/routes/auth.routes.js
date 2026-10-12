import express from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { loginValidator } from '../validators/auth.validator.js';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const authController = new AuthController();

// POST /api/auth/login - Login user
router.post(
  '/login',
  loginRateLimiter,
  loginValidator,
  validate,
  authController.login
);

// GET /api/auth/me - Get current user
router.get(
  '/me',
  authenticate,
  authController.me
);

// POST /api/auth/logout - Logout user
router.post(
  '/logout',
  authenticate,
  authController.logout
);

export default router;
