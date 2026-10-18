// backend/src/utils/auditLog.js
// Task 14 — Audit log utility untuk operasi sensitif

import { query } from '../config/database.js';

/**
 * Catat operasi sensitif ke tabel audit_logs.
 * Error pada audit log TIDAK akan menghentikan main flow.
 *
 * @param {object} opts
 * @param {number}  opts.userId      — ID user yang melakukan aksi
 * @param {string}  opts.action      — 'task.delete' | 'telegram.config.save' | 'telegram.config.delete' | ...
 * @param {string}  [opts.entityType] — 'task' | 'file' | 'telegram_config'
 * @param {number}  [opts.entityId]  — ID resource yang dioperasi
 * @param {object}  [opts.meta]      — Info tambahan NON-SENSITIF (jangan masukkan token, password, key)
 * @param {object}  [opts.req]       — Express request object (untuk ip + user-agent)
 */
export async function auditLog({ userId, action, entityType, entityId, meta, req }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, meta, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
      [
        userId     ?? null,
        action,
        entityType ?? null,
        entityId   ?? null,
        meta       ? JSON.stringify(meta) : null,
        req?.ip    ?? null,
        req?.headers?.['user-agent']?.slice(0, 500) ?? null,
      ]
    );
  } catch (err) {
    // Audit log TIDAK boleh break main flow — log saja ke console
    console.error('[AuditLog] Failed to write audit entry:', {
      action,
      entityType,
      entityId,
      error: err.message,
    });
  }
}
