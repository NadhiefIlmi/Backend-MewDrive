import { TelegramService } from '../services/telegram.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { query } from '../config/database.js';

const svc = new TelegramService();

const handleError = (res, next, err) => {
  if (err.message === 'BOT_BLOCKED')      return sendError(res, 'BOT_BLOCKED', 'Bot diblokir oleh user Telegram. Unblock bot lalu coba lagi.', 422);
  if (err.message === 'CHAT_NOT_FOUND')   return sendError(res, 'CHAT_NOT_FOUND', 'Chat ID tidak ditemukan. Pastikan kamu sudah start bot terlebih dahulu.', 422);
  if (err.message === 'CONFIG_NOT_FOUND') return sendError(res, 'CONFIG_NOT_FOUND', 'Konfigurasi Telegram belum dibuat', 404);
  if (err.message?.startsWith('TELEGRAM_ERROR')) {
    const detail = err.message.replace('TELEGRAM_ERROR: ', '');
    return sendError(res, 'TELEGRAM_ERROR', detail || 'Token bot tidak valid. Cek ulang token dari BotFather.', 422);
  }

  next(err);
};

// POST /api/telegram/config
export const saveConfig = async (req, res, next) => {
  try {
    const result = await svc.saveAndTest(req.user.id, req.body, req);
    return sendSuccess(res, result, 'Konfigurasi disimpan dan bot berhasil terhubung');
  } catch (e) { handleError(res, next, e); }
};

// GET /api/telegram/config
export const getConfig = async (req, res, next) => {
  try {
    const status = await svc.getStatus(req.user.id);
    return sendSuccess(res, status);
  } catch (e) { next(e); }
};

// DELETE /api/telegram/config
export const deleteConfig = async (req, res, next) => {
  try {
    const result = await svc.deleteConfig(req.user.id, req);
    return sendSuccess(res, result, 'Konfigurasi Telegram dihapus');
  } catch (e) { next(e); }
};

// POST /api/telegram/test
export const testConfig = async (req, res, next) => {
  try {
    const result = await svc.testConnection(req.user.id);
    return sendSuccess(res, result, 'Pesan tes berhasil dikirim');
  } catch (e) { handleError(res, next, e); }
};

// GET /api/telegram/preferences
export const getPreferences = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT report_enabled, frequency, send_hour, send_minute, send_day, report_type
       FROM notification_preferences WHERE user_id = $1`,
      [req.user.id]
    );
    // Kalau belum ada, kembalikan default
    const prefs = result.rows[0] ?? {
      report_enabled: false,
      frequency: 'daily',
      send_hour: 8,
      send_minute: 0,
      send_day: 1,
      report_type: 'summary',
    };
    return sendSuccess(res, prefs);
  } catch (e) { next(e); }
};

// PATCH /api/telegram/preferences
export const updatePreferences = async (req, res, next) => {
  try {
    const { report_enabled, frequency, send_hour, send_minute, send_day, report_type } = req.body;
    await query(
      `INSERT INTO notification_preferences (
         user_id, report_enabled, frequency, send_hour, send_minute, send_day, report_type, updated_at
       )
       VALUES (
         $1,
         COALESCE($2, false),
         COALESCE($3, 'daily'),
         COALESCE($4, 8),
         COALESCE($5, 0),
         COALESCE($6, 1),
         COALESCE($7, 'summary'),
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id) DO UPDATE SET
         report_enabled = COALESCE(EXCLUDED.report_enabled, notification_preferences.report_enabled),
         frequency      = COALESCE(EXCLUDED.frequency, notification_preferences.frequency),
         send_hour      = COALESCE(EXCLUDED.send_hour, notification_preferences.send_hour),
         send_minute    = COALESCE(EXCLUDED.send_minute, notification_preferences.send_minute),
         send_day       = COALESCE(EXCLUDED.send_day, notification_preferences.send_day),
         report_type    = COALESCE(EXCLUDED.report_type, notification_preferences.report_type),
         updated_at     = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        report_enabled !== undefined ? report_enabled : null,
        frequency !== undefined ? frequency : null,
        send_hour !== undefined ? Number(send_hour) : null,
        send_minute !== undefined ? Number(send_minute) : null,
        send_day !== undefined ? Number(send_day) : null,
        report_type !== undefined ? report_type : null,
      ]
    );
    return sendSuccess(res, { updated: true }, 'Preferensi jadwal berhasil disimpan');
  } catch (e) { next(e); }
};

