import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import roleRoutes from './role.routes.js';
import permissionRoutes from './permission.routes.js';
import folderRoutes from './folder.routes.js';
import fileRoutes from './file.routes.js';
import searchRoutes from './search.routes.js';
import storageRoutes from './storage.routes.js';
import notesRoutes from './notes.routes.js';
import shareRoutes from './share.routes.js';
import taskRoutes from './task.routes.js';
import telegramRoutes from './telegram.routes.js';
import { pool } from '../config/database.js';
import { config } from '../config/env.js';

const router = express.Router();

// ─── Health check ─────────────────────────────────────────────────────────────
// Cek database connection juga — bukan hanya "server nyala"
// Dipakai oleh load balancer, monitoring, dan deployment pipeline
router.get('/health', async (req, res) => {
  const startMs = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = null;

  try {
    const t = Date.now();
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - t;
  } catch (err) {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'ok';
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    success: isHealthy,
    data: {
      status:       isHealthy ? 'ok' : 'degraded',
      version:      process.env.npm_package_version ?? '1.0.0',
      environment:  config.env,
      cicd:         'auto-deployed via GitHub Actions 🚀',
      uptime_s:     Math.floor(process.uptime()),
      timestamp:    new Date().toISOString(),
      checks: {
        database: {
          status:     dbStatus,
          latency_ms: dbLatencyMs,
        },
      },
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
// User permission routes live under /permissions prefix
router.use('/', permissionRoutes);
router.use('/folders', folderRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);
router.use('/storage', storageRoutes);
router.use('/notes', notesRoutes);
router.use('/share', shareRoutes);
router.use('/tasks', taskRoutes);
router.use('/telegram', telegramRoutes);

export default router;
