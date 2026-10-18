import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { telegramRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validator.js';
import {
  saveTelegramConfigValidator,
  updatePreferencesValidator,
} from '../validators/telegram.validator.js';
import {
  saveConfig,
  getConfig,
  deleteConfig,
  testConfig,
  getPreferences,
  updatePreferences,
} from '../controllers/telegram.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/',               getConfig);
router.post('/',              telegramRateLimiter, saveTelegramConfigValidator, validate, saveConfig);
router.delete('/',            deleteConfig);
router.post('/test',          telegramRateLimiter, testConfig);
router.get('/preferences',   getPreferences);
// Task 14 fix F-02: tambah validator untuk enum frequency dan report_type
router.patch('/preferences', updatePreferencesValidator, validate, updatePreferences);

export default router;
