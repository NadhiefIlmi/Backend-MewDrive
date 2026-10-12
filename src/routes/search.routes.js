import express from 'express';
import { search } from '../controllers/search.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', search); // GET /api/search?q=keyword

export default router;
