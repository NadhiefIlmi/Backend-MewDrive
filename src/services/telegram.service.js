import crypto from 'crypto';
import { TelegramRepository } from '../repositories/telegram.repository.js';
import { config } from '../config/env.js';
import { auditLog } from '../utils/auditLog.js';

const repo = new TelegramRepository();

// AES-256-GCM encrypt
function encrypt(plaintext) {
  const key = Buffer.from(config.telegramEncryptionKey, 'hex');
  const iv  = crypto.randomBytes(12); // 96-bit IV untuk GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv:         iv.toString('hex'),
    authTag:    authTag.toString('hex'),
  };
}

// AES-256-GCM decrypt
function decrypt(ciphertext, iv, authTag) {
  const key      = Buffer.from(config.telegramEncryptionKey, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// Kirim pesan via Telegram Bot API (outgoing only, tidak perlu webhook)
async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  const data = await res.json();
  if (!data.ok) {
    // Terjemahkan error Telegram ke kode yang lebih informatif
    const desc = data.description ?? '';
    if (desc.includes('bot was blocked')) throw new Error('BOT_BLOCKED');
    if (desc.includes('chat not found'))  throw new Error('CHAT_NOT_FOUND');
    throw new Error(`TELEGRAM_ERROR: ${desc}`);
  }
  return data.result;
}

export class TelegramService {

  // Simpan config + langsung tes koneksi
  async saveAndTest(userId, { bot_token, chat_id }, req = null) {
    // Kirim pesan tes terlebih dahulu — jika gagal, error dilempar dan tidak ada config rusak yang tersimpan
    const testMsg =
      '✅ <b>MewDrive berhasil terhubung!</b>\n\nBot kamu sudah aktif dan siap mengirim laporan task.\nAtur jadwal laporan di <b>Settings → Telegram Report</b>.';

    const result = await sendTelegramMessage(bot_token, chat_id, testMsg);

    // Enkripsi token sebelum simpan
    const { ciphertext, iv, authTag } = encrypt(bot_token);

    // Simpan ke DB langsung terverifikasi
    await repo.upsert(userId, {
      bot_token_enc: ciphertext,
      iv,
      auth_tag: authTag,
      chat_id,
      is_verified: true,
    });

    // Update is_verified = true dan verified_at
    await repo.setVerified(userId, result.message_id);

    // Task 14 — audit log penyimpanan config (tanpa token!)
    await auditLog({
      userId,
      action:     'telegram.config.save',
      entityType: 'telegram_config',
      meta:       { chat_id_suffix: String(chat_id).slice(-4) },
      req,
    });

    return this.getStatus(userId);
  }


  // Kirim ulang pesan tes tanpa ubah config
  async testConnection(userId) {
    const cfg = await repo.findByUser(userId);
    if (!cfg) throw new Error('CONFIG_NOT_FOUND');

    const token  = decrypt(cfg.bot_token_enc, cfg.iv, cfg.auth_tag);
    const testMsg = '🔔 <b>Test koneksi MewDrive</b>\n\nBot kamu masih aktif dan terhubung.';


    await sendTelegramMessage(token, cfg.chat_id, testMsg);
    return { sent: true };
  }

  // Status config — TIDAK mengekspos token atau karakter aslinya ke frontend
  // Task 14 fix F-01: hapus token_mask yang mengekspos Bot ID + partial chars
  async getStatus(userId) {
    const cfg = await repo.findByUser(userId);
    if (!cfg) return { configured: false };

    // Mask chat_id: tampilkan 4 digit terakhir saja
    const maskedChatId = String(cfg.chat_id).replace(/.(?=.{4})/g, '*');

    return {
      configured:   true,
      is_verified:  cfg.is_verified,
      verified_at:  cfg.verified_at,
      chat_id_mask: maskedChatId,
      has_token:    true,  // frontend hanya perlu tahu "token sudah tersimpan"
    };
  }

  async deleteConfig(userId, req = null) {
    await repo.delete(userId);

    // Task 14 — audit log penghapusan config
    await auditLog({
      userId,
      action:     'telegram.config.delete',
      entityType: 'telegram_config',
      req,
    });

    return { deleted: true };
  }

  // Dipakai oleh report.service.js — internal only, tidak di-expose ke endpoint
  async getDecryptedToken(userId) {
    const cfg = await repo.findByUser(userId);
    if (!cfg || !cfg.is_verified) return null;
    return {
      token:   decrypt(cfg.bot_token_enc, cfg.iv, cfg.auth_tag),
      chat_id: cfg.chat_id,
    };
  }
}
