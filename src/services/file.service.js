import { FileRepository } from '../repositories/file.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import fs from 'fs/promises';
import path from 'path';

const fileRepo   = new FileRepository();
const folderRepo = new FolderRepository();
const userRepo   = new UserRepository();

export class FileService {

  // List starred files milik user
  async listStarredFiles(userId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    return await fileRepo.findStarredByUser(userId, { limit, offset });
  }

  // List recent files milik user
  async listRecentFiles(userId, limit = 20) {
    return await fileRepo.findRecentByUser(userId, limit);
  }

  // Touch last_accessed_at (dipanggil dari download & preview controllers)
  async touchAccessed(fileId) {
    await fileRepo.touchAccessed(fileId);
  }

  // List file di root atau dalam folder — dengan pagination
  async listFiles(userId, folderId = null, { page = 1, limit = 50 } = {}) {
    if (folderId) {
      const folder = await folderRepo.findById(folderId);
      if (!folder || folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    }
    const offset = (page - 1) * limit;
    return await fileRepo.findByUser(userId, folderId, { limit, offset });
  }

  // Detail file
  async getFile(userId, fileId, isAdmin = false) {
    const file = await fileRepo.findById(fileId);
    if (!file) throw new Error('FILE_NOT_FOUND');
    if (!isAdmin && file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    // Strip storage_path — path fisik tidak boleh bocor ke response API
    const { storage_path, ...safeFile } = file;
    return safeFile;
  }

  // Rename file
  async renameFile(userId, fileId, newName) {
    const file = await fileRepo.findById(fileId);
    if (!file || file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    if (file.is_trashed) throw new Error('FILE_TRASHED');

    newName = newName?.trim();
    if (!newName) throw new Error('FILE_NAME_REQUIRED');
    if (newName.length > 255) throw new Error('FILE_NAME_TOO_LONG');

    const duplicate = await fileRepo.existsByName(userId, newName, file.folder_id, fileId);
    if (duplicate) throw new Error('FILE_NAME_EXISTS');

    return await fileRepo.update(fileId, { name: newName });
  }

  // Toggle starred
  async toggleStar(userId, fileId) {
    const file = await fileRepo.findById(fileId);
    if (!file || file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    return await fileRepo.update(fileId, { is_starred: !file.is_starred });
  }

  // Pindahkan ke trash
  async trashFile(userId, fileId) {
    const file = await fileRepo.findById(fileId);
    if (!file || file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    if (file.is_trashed) throw new Error('FILE_ALREADY_TRASHED');
    return await fileRepo.trash(fileId);
  }

  // Restore dari trash
  async restoreFile(userId, fileId) {
    const file = await fileRepo.findById(fileId);
    if (!file || file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    if (!file.is_trashed) throw new Error('FILE_NOT_TRASHED');

    // Cek duplikat nama di lokasi asal
    const duplicate = await fileRepo.existsByName(userId, file.name, file.folder_id, fileId);
    if (duplicate) throw new Error('FILE_NAME_EXISTS');

    return await fileRepo.restore(fileId);
  }

  // Hapus file permanen (fisik + DB + update quota)
  async deletePermanent(userId, fileId, isAdmin = false) {
    const file = await fileRepo.findById(fileId);
    if (!file) throw new Error('FILE_NOT_FOUND');
    if (!isAdmin && file.user_id !== userId) throw new Error('FILE_NOT_FOUND');

    // Hapus record dari DB
    const deleted = await fileRepo.deletePermanent(fileId);
    if (!deleted) throw new Error('FILE_NOT_FOUND');

    // Hapus file fisik dari storage (tidak error jika sudah tidak ada)
    if (deleted.storage_path) {
      try {
        await fs.unlink(deleted.storage_path);
      } catch {
        // File fisik tidak ada — abaikan
      }
    }

    // Update storage_used user
    const user = await userRepo.findById(userId);
    if (user) {
      const newUsed = Math.max(0, Number(user.storage_used) - Number(deleted.size));
      await userRepo.updateStorageUsed(userId, newUsed);
    }

    return { id: deleted.id, name: deleted.name };
  }

  // Pindahkan file ke folder baru
  async moveFile(userId, fileId, targetFolderId) {
    const file = await fileRepo.findById(fileId);
    if (!file || file.user_id !== userId) throw new Error('FILE_NOT_FOUND');
    if (file.is_trashed) throw new Error('FILE_TRASHED');

    // Tidak ada perubahan (sudah di folder yang sama)
    const currentFolder = file.folder_id ?? null;
    if (currentFolder === targetFolderId) return file;

    if (targetFolderId !== null) {
      const target = await folderRepo.findById(targetFolderId);
      if (!target || target.user_id !== userId) throw new Error('TARGET_FOLDER_NOT_FOUND');
      if (target.is_trashed) throw new Error('TARGET_FOLDER_TRASHED');
    }

    // Cek duplikat nama di lokasi tujuan
    const duplicate = await fileRepo.existsByName(userId, file.name, targetFolderId, fileId);
    if (duplicate) throw new Error('FILE_NAME_EXISTS');

    return await fileRepo.move(fileId, targetFolderId);
  }

  // Hapus semua file trashed milik user (empty trash) — ambil semua tanpa limit
  async emptyTrash(userId) {
    const { files: trashed } = await fileRepo.findTrashedByUser(userId, { limit: 10000, offset: 0 });
    let totalFreed = 0;

    for (const file of trashed) {
      await fileRepo.deletePermanent(file.id);
      if (file.storage_path) {
        try { await fs.unlink(file.storage_path); } catch { /* abaikan */ }
      }
      totalFreed += Number(file.size);
    }

    if (totalFreed > 0) {
      const user = await userRepo.findById(userId);
      if (user) {
        const newUsed = Math.max(0, Number(user.storage_used) - totalFreed);
        await userRepo.updateStorageUsed(userId, newUsed);
      }
    }

    return { deleted: trashed.length, freed: totalFreed };
  }

  // Bulk restore files dari trash (berdasarkan array of ids)
  async bulkRestoreFiles(userId, fileIds) {
    const results = { restored: [], failed: [] };

    for (const fileId of fileIds) {
      try {
        const file = await fileRepo.findById(fileId);
        if (!file || file.user_id !== userId) {
          results.failed.push({ id: fileId, reason: 'not_found' });
          continue;
        }
        if (!file.is_trashed) {
          results.failed.push({ id: fileId, reason: 'not_trashed' });
          continue;
        }
        // Jika nama duplikat di lokasi asal, tetap restore tapi beri suffix timestamp
        const duplicate = await fileRepo.existsByName(userId, file.name, file.folder_id, fileId);
        if (duplicate) {
          const ext  = file.extension ? `.${file.extension}` : '';
          const base = file.name.endsWith(ext) ? file.name.slice(0, -ext.length) : file.name;
          const newName = `${base}_restored_${Date.now()}${ext}`;
          await fileRepo.update(fileId, { name: newName });
        }
        const restored = await fileRepo.restore(fileId);
        results.restored.push(restored);
      } catch {
        results.failed.push({ id: fileId, reason: 'error' });
      }
    }

    return results;
  }
}
