import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { taskRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validator.js';
import {
  createTaskValidator,
  updateTaskValidator,
  listTaskValidator,
} from '../validators/task.validator.js';
import {
  listTasks, getTask, createTask, updateTask,
  deleteTask, moveTaskStatus, attachFile, detachFile,
} from '../controllers/task.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/',                           listTaskValidator, validate, listTasks);
router.get('/:id',                        getTask);
router.post('/',          taskRateLimiter, createTaskValidator, validate, createTask);
router.patch('/:id',                      updateTaskValidator, validate, updateTask);
router.delete('/:id',                     deleteTask);
router.patch('/:id/status',               moveTaskStatus);
router.post('/:id/files',                 attachFile);
router.delete('/:id/files/:fileId',       detachFile);

export default router;
