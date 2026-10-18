import { TaskRepository } from '../repositories/task.repository.js';
import { TelegramService } from './telegram.service.js';
import { query } from '../config/database.js';

const taskRepo = new TaskRepository();
const tgSvc    = new TelegramService();

// Build teks pesan laporan format Ringkasan (Summary)
function buildSummaryReport(summary, highPriority, deadlines, titlePrefix = 'Daily') {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Summary per status
  const counts = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
  for (const row of summary) {
    counts[row.status] = parseInt(row.count, 10);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return `📋 <b>${titlePrefix} Task Report</b>\n${today}\n\nTidak ada task aktif saat ini. 🎉`;
  }

  let msg = `📋 <b>${titlePrefix} Task Report (Ringkasan)</b>\n${today}\n\n`;
  msg += `<b>Ringkasan Status</b>\n`;
  msg += `📝 To Do: ${counts.todo}\n`;
  msg += `🔄 In Progress: ${counts.in_progress}\n`;
  msg += `👀 In Review: ${counts.in_review}\n`;
  msg += `✅ Done: ${counts.done}\n`;
  msg += `Total: ${total} task\n`;

  if (highPriority.length > 0) {
    msg += `\n🔥 <b>Prioritas High / Critical</b>\n`;
    for (const t of highPriority) {
      msg += `• ${t.title} (${t.status.replace('_', ' ')})\n`;
    }
  }

  if (deadlines.length > 0) {
    msg += `\n⏰ <b>Deadline Terdekat</b>\n`;
    for (const t of deadlines) {
      const d = new Date(t.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      msg += `• ${t.title} — ${d}\n`;
    }
  }

  msg += `\n🔗 <i>Buka MewDrive untuk mengelola task</i>`;
  return msg.trim();
}

// Build teks pesan laporan format Detail (Daftar semua task per status)
function buildDetailedReport(tasks, titlePrefix = 'Daily') {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (!tasks || tasks.length === 0) {
    return `📄 <b>${titlePrefix} Task Report (Detail)</b>\n${today}\n\nBelum ada task yang dibuat. Buat task pertamamu di MewDrive! 🎉`;
  }

  const statusGroups = {
    todo: { label: '📝 TO DO', items: [] },
    in_progress: { label: '🔄 IN PROGRESS', items: [] },
    in_review: { label: '👀 IN REVIEW', items: [] },
    done: { label: '✅ DONE', items: [] },
  };

  for (const t of tasks) {
    if (statusGroups[t.status]) {
      statusGroups[t.status].items.push(t);
    }
  }

  let msg = `📄 <b>${titlePrefix} Task Report (Detail)</b>\n${today}\n\n`;

  for (const [, group] of Object.entries(statusGroups)) {
    if (group.items.length === 0) continue;
    msg += `<b>${group.label} (${group.items.length})</b>\n`;
    for (const item of group.items) {
      let line = `• ${item.title}`;
      const meta = [];
      if (item.priority === 'critical') meta.push('🔴 Critical');
      else if (item.priority === 'high') meta.push('🔥 High');
      else if (item.priority === 'low') meta.push('🟢 Low');

      if (item.due_date) {
        const d = new Date(item.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        meta.push(`⏰ ${d}`);
      }

      if (meta.length > 0) {
        line += ` [${meta.join(', ')}]`;
      }
      msg += `${line}\n`;
    }
    msg += `\n`;
  }

  const doneCount = statusGroups.done.items.length;
  const activeCount = tasks.length - doneCount;
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 <b>Total: ${tasks.length} task</b> (${activeCount} aktif, ${doneCount} selesai)\n`;
  msg += `🔗 <i>Buka MewDrive untuk mengelola task</i>`;

  return msg.trim();
}

export class ReportService {

  // Kirim laporan harian ke semua user yang report_enabled = true (cocok jam & menit)
  async sendDailyReports() {
    const usersRes = await query(
      `SELECT tc.user_id, tc.bot_token_enc, tc.iv, tc.auth_tag, tc.chat_id,
              np.report_type, np.send_hour, np.send_minute
       FROM telegram_configs tc
       JOIN notification_preferences np ON np.user_id = tc.user_id
       WHERE tc.is_verified = true
         AND np.report_enabled = true
         AND np.frequency = 'daily'
         AND np.send_hour = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Jakarta')::int
         AND np.send_minute = EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Jakarta')::int`,
      []
    );

    for (const user of usersRes.rows) {
      // Task 14 fix F-04: per-user try/catch agar satu user gagal tidak hentikan loop
      try {
        await this._sendReportToUser(user, 'daily_report', 'Daily');
      } catch (err) {
        console.error(`[ReportService] Unexpected error for user ${user.user_id}:`, err.message);
      }
    }
  }

  // Kirim laporan mingguan (cocok hari, jam & menit)
  async sendWeeklyReports() {
    const nowJkt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const dayOfWeek = nowJkt.getDay() === 0 ? 7 : nowJkt.getDay(); // 1=Senin...7=Minggu

    const usersRes = await query(
      `SELECT tc.user_id, tc.bot_token_enc, tc.iv, tc.auth_tag, tc.chat_id,
              np.report_type, np.send_hour, np.send_minute, np.send_day
       FROM telegram_configs tc
       JOIN notification_preferences np ON np.user_id = tc.user_id
       WHERE tc.is_verified = true
         AND np.report_enabled = true
         AND np.frequency = 'weekly'
         AND np.send_day = $1
         AND np.send_hour = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Jakarta')::int
         AND np.send_minute = EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Jakarta')::int`,
      [dayOfWeek]
    );

    for (const user of usersRes.rows) {
      // Task 14 fix F-04: per-user try/catch agar satu user gagal tidak hentikan loop
      try {
        await this._sendReportToUser(user, 'weekly_report', 'Weekly');
      } catch (err) {
        console.error(`[ReportService] Unexpected error for user ${user.user_id}:`, err.message);
      }
    }
  }

  async _sendReportToUser(user, type = 'daily_report', titlePrefix = 'Daily') {
    let status = 'sent';
    let errorMsg = null;
    let telegramMsgId = null;

    try {
      const creds = await tgSvc.getDecryptedToken(user.user_id);
      if (!creds) return; // skip

      let text = '';
      if (user.report_type === 'detailed') {
        const { tasks } = await taskRepo.findByUser(user.user_id, { limit: 100 });
        text = buildDetailedReport(tasks, titlePrefix);
      } else {
        const [summary, highPriority, deadlines] = await Promise.all([
          taskRepo.getSummaryByUser(user.user_id),
          taskRepo.getHighPriorityActive(user.user_id),
          taskRepo.getUpcomingDeadlines(user.user_id),
        ]);
        text = buildSummaryReport(summary, highPriority, deadlines, titlePrefix);
      }

      const result = await fetch(
        `https://api.telegram.org/bot${creds.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: creds.chat_id, text, parse_mode: 'HTML' }),
        }
      );
      const data = await result.json();
      if (data.ok) telegramMsgId = data.result.message_id;
      else { status = 'failed'; errorMsg = data.description; }

    } catch (err) {
      status   = 'failed';
      errorMsg = err.message;
    }

    // Log hasil pengiriman
    await query(
      `INSERT INTO notification_logs (user_id, type, status, error_message, telegram_msg_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.user_id, type, status, errorMsg, telegramMsgId]
    );
  }
}
