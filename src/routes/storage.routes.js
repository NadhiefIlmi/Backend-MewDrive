import express from 'express';
import { getStorage } from '../controllers/storage.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getStorage); // GET /api/storage

export default router;
