import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.middleware.js';
import { shareRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validator.js';
import { createShareLinkValidator } from '../validators/share.validator.js';
import {
  createShareLink,
  listShareLinks,
  toggleShareLink,
  deleteShareLink,
  updateShareLinkSlug,
  getPublicShareInfo,
  getPublicShareInfoBySlug,
  publicPreview,
  publicDownload,
  publicPreviewBySlug,
  publicDownloadBySlug,
} from '../controllers/share.controller.js';

const router = express.Router();

// ─── Public (tanpa auth) ──────────────────────────────────────────────────────
// PENTING: route slug harus SEBELUM route :token supaya tidak bentrok
router.get('/public/slug/:slug',          getPublicShareInfoBySlug);
router.get('/public/slug/:slug/preview',  publicPreviewBySlug);
router.get('/public/slug/:slug/download', publicDownloadBySlug);

router.get('/public/:token',          getPublicShareInfo);
router.get('/public/:token/preview',  publicPreview);
router.get('/public/:token/download', publicDownload);

// ─── Protected (butuh login + permission share_files) ─────────────────────────
router.use(authenticate);

router.get('/',              requirePermission('share_files'), listShareLinks);
router.post('/',             shareRateLimiter, requirePermission('share_files'), createShareLinkValidator, validate, createShareLink);
router.patch('/:id/toggle',  requirePermission('share_files'), toggleShareLink);
router.patch('/:id/slug',    requirePermission('share_files'), updateShareLinkSlug);
router.delete('/:id',        requirePermission('share_files'), deleteShareLink);

export default router;
