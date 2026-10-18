import { TaskRepository } from '../repositories/task.repository.js';
import { query } from '../config/database.js';
import { auditLog } from '../utils/auditLog.js';

const repo = new TaskRepository();

export class TaskService {

  async listTasks(userId, filters) {
    return repo.findByUser(userId, filters);
  }

  async getTask(userId, taskId) {
    const task = await repo.findById(taskId);
    if (!task)                   throw new Error('TASK_NOT_FOUND');
    if (task.user_id !== userId) throw new Error('FORBIDDEN');

    const files = await repo.findAttachedFiles(taskId);
    return { ...task, files };
  }

  async createTask(userId, body) {
    return repo.create(userId, body);
  }

  async updateTask(userId, taskId, body) {
    const task = await repo.findById(taskId);
    if (!task)                   throw new Error('TASK_NOT_FOUND');
    if (task.user_id !== userId) throw new Error('FORBIDDEN');

    const updated = await repo.update(taskId, body);
    return updated;
  }

  async deleteTask(userId, taskId, req = null) {
    const task = await repo.findById(taskId);
    if (!task)                   throw new Error('TASK_NOT_FOUND');
    if (task.user_id !== userId) throw new Error('FORBIDDEN');

    const deleted = await repo.delete(taskId);

    // Task 14 — audit log operasi delete task
    await auditLog({
      userId,
      action:     'task.delete',
      entityType: 'task',
      entityId:   taskId,
      meta:       { title: task.title },
      req,
    });

    return deleted;
  }

  // Attach file dari drive — verifikasi file milik userId dulu
  async attachFile(userId, taskId, fileId) {
    const task = await repo.findById(taskId);
    if (!task)                   throw new Error('TASK_NOT_FOUND');
    if (task.user_id !== userId) throw new Error('FORBIDDEN');

    // Verifikasi file milik user yang sama
    const fileRes = await query(
      `SELECT id FROM files WHERE id = $1 AND user_id = $2 AND is_trashed = false`,
      [fileId, userId]
    );
    if (fileRes.rows.length === 0) throw new Error('FILE_NOT_FOUND');

    await repo.attachFile(taskId, fileId);
    return repo.findAttachedFiles(taskId);
  }

  async detachFile(userId, taskId, fileId) {
    const task = await repo.findById(taskId);
    if (!task)                   throw new Error('TASK_NOT_FOUND');
    if (task.user_id !== userId) throw new Error('FORBIDDEN');

    await repo.detachFile(taskId, fileId);
    return { detached: true };
  }
}
