import cron from 'node-cron';
import { ReportService } from './services/report.service.js';

const reportSvc = new ReportService();

export function startScheduler() {
  // Jalankan setiap menit untuk mencocokkan send_hour & send_minute user
  cron.schedule('* * * * *', async () => {
    try {
      await Promise.all([
        reportSvc.sendDailyReports(),
        reportSvc.sendWeeklyReports(),
      ]);
    } catch (err) {
      console.error('[Scheduler] Error sending reports:', err.message);
    }
  });

  console.log('✓ Report scheduler started (runs every minute to check scheduled reports)');
}
