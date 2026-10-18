import { body } from 'express-validator';

export const saveTelegramConfigValidator = [
  body('bot_token')
    .trim().notEmpty().withMessage('Bot token wajib diisi')
    // Format Telegram token: angka:string (contoh: 123456789:AAFxxxxxx)
    .matches(/^\d+:[A-Za-z0-9_-]{35,}$/).withMessage('Format bot token tidak valid'),
  body('chat_id')
    .notEmpty().withMessage('Chat ID wajib diisi')
    .isInt().withMessage('Chat ID harus berupa angka')
    .toInt(),
];

// Task 14 — validator untuk PATCH /api/telegram/preferences
// Mencegah nilai arbitrary masuk ke kolom frequency dan report_type (temuan F-02)
export const updatePreferencesValidator = [
  body('report_enabled')
    .optional().isBoolean().withMessage('report_enabled harus boolean'),
  body('frequency')
    .optional().isIn(['daily', 'weekly']).withMessage('frequency harus daily atau weekly'),
  body('send_hour')
    .optional().isInt({ min: 0, max: 23 }).withMessage('send_hour harus antara 0–23').toInt(),
  body('send_minute')
    .optional().isInt({ min: 0, max: 59 }).withMessage('send_minute harus antara 0–59').toInt(),
  body('send_day')
    .optional().isInt({ min: 1, max: 7 }).withMessage('send_day harus antara 1–7 (1=Senin, 7=Minggu)').toInt(),
  body('report_type')
    .optional().isIn(['summary', 'detailed']).withMessage('report_type harus summary atau detailed'),
];
