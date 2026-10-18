import { query } from '../config/database.js';

export class TelegramRepository {

  async findByUser(userId) {
    const result = await query(
      `SELECT user_id, bot_token_enc, iv, auth_tag, chat_id, is_verified, verified_at
       FROM telegram_configs WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async upsert(userId, { bot_token_enc, iv, auth_tag, chat_id, is_verified }) {
    await query(
      `INSERT INTO telegram_configs (user_id, bot_token_enc, iv, auth_tag, chat_id, is_verified, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         bot_token_enc = EXCLUDED.bot_token_enc,
         iv            = EXCLUDED.iv,
         auth_tag      = EXCLUDED.auth_tag,
         chat_id       = EXCLUDED.chat_id,
         is_verified   = EXCLUDED.is_verified,
         verified_at   = CASE WHEN EXCLUDED.is_verified THEN CURRENT_TIMESTAMP ELSE telegram_configs.verified_at END,
         updated_at    = CURRENT_TIMESTAMP`,
      [userId, bot_token_enc, iv, auth_tag, chat_id, is_verified]
    );
  }

  async setVerified(userId) {
    await query(
      `UPDATE telegram_configs
       SET is_verified = true, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  }

  async delete(userId) {
    await query(`DELETE FROM telegram_configs WHERE user_id = $1`, [userId]);
  }

  // Untuk scheduler — ambil semua user yang sudah verified + report_enabled
  async findAllVerified() {
    const result = await query(
      `SELECT tc.user_id, tc.bot_token_enc, tc.iv, tc.auth_tag, tc.chat_id,
              np.frequency, np.send_hour, np.send_day, np.report_type
       FROM telegram_configs tc
       JOIN notification_preferences np ON np.user_id = tc.user_id
       WHERE tc.is_verified = true
         AND np.report_enabled = true`,
      []
    );
    return result.rows;
  }
}
