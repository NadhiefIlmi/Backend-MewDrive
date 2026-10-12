import { FolderRepository } from '../repositories/folder.repository.js';
import { FileRepository } from '../repositories/file.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

const folderRepo = new FolderRepository();
const fileRepo   = new FileRepository();
const userRepo   = new UserRepository();

export class FolderService {

  // List starred folders milik user
  async listStarredFolders(userId, { page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    return await folderRepo.findStarredByUser(userId, { limit, offset });
  }

  // List folder di root atau dalam parent — dengan pagination
  async listFolders(userId, parentId = null, { page = 1, limit = 50 } = {}) {
    if (parentId) {
      const parent = await folderRepo.findById(parentId);
      if (!parent || parent.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    }
    const offset = (page - 1) * limit;
    return await folderRepo.findByUser(userId, parentId, { limit, offset });
  }

  // Detail folder
  async getFolder(userId, folderId, isAdmin = false) {
    const folder = await folderRepo.findById(folderId);
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    if (!isAdmin && folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    return folder;
  }

  // Buat folder baru
  async createFolder(userId, { name, parentId = null, color = 'default', icon = 'folder' }) {
    name = name?.trim();
    if (!name) throw new Error('FOLDER_NAME_REQUIRED');
    if (name.length > 255) throw new Error('FOLDER_NAME_TOO_LONG');

    // Validasi parent ada dan milik user
    if (parentId) {
      const parent = await folderRepo.findById(parentId);
      if (!parent || parent.user_id !== userId) throw new Error('PARENT_FOLDER_NOT_FOUND');
      if (parent.is_trashed) throw new Error('PARENT_FOLDER_TRASHED');
    }

    // Cek duplikat nama
    const duplicate = await folderRepo.existsByName(userId, name, parentId);
    if (duplicate) throw new Error('FOLDER_NAME_EXISTS');

    return await folderRepo.create({ userId, parentId, name, color, icon });
  }

  // Rename folder atau ubah color/starred
  async updateFolder(userId, folderId, { name, color, icon, is_starred }) {
    const folder = await folderRepo.findById(folderId);
    if (!folder || folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    if (folder.is_trashed) throw new Error('FOLDER_TRASHED');

    if (name !== undefined) {
      name = name.trim();
      if (!name) throw new Error('FOLDER_NAME_REQUIRED');
      if (name.length > 255) throw new Error('FOLDER_NAME_TOO_LONG');

      // Cek duplikat (kecuali diri sendiri)
      const duplicate = await folderRepo.existsByName(userId, name, folder.parent_id, folderId);
      if (duplicate) throw new Error('FOLDER_NAME_EXISTS');
    }

    return await folderRepo.update(folderId, { name, color, icon, is_starred });
  }

  // Pindahkan ke trash
  async trashFolder(userId, folderId) {
    const folder = await folderRepo.findById(folderId);
    if (!folder || folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    if (folder.is_trashed) throw new Error('FOLDER_ALREADY_TRASHED');
    return await folderRepo.trash(folderId);
  }

  // Restore dari trash
  async restoreFolder(userId, folderId) {
    const folder = await folderRepo.findById(folderId);
    if (!folder || folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    if (!folder.is_trashed) throw new Error('FOLDER_NOT_TRASHED');

    // Cek duplikat nama di lokasi asal setelah restore
    const duplicate = await folderRepo.existsByName(userId, folder.name, folder.parent_id, folderId);
    if (duplicate) throw new Error('FOLDER_NAME_EXISTS');

    return await folderRepo.restore(folderId);
  }

  // Pindahkan folder ke parent baru
  async moveFolder(userId, folderId, targetParentId) {
    const folder = await folderRepo.findById(folderId);
    if (!folder || folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');
    if (folder.is_trashed) throw new Error('FOLDER_TRASHED');

    // Tidak boleh pindah ke diri sendiri
    if (targetParentId === folderId) throw new Error('CANNOT_MOVE_INTO_SELF');

    // Tidak ada perubahan (sudah di parent yang sama)
    const currentParent = folder.parent_id ?? null;
    if (currentParent === targetParentId) return folder;

    if (targetParentId !== null) {
      const target = await folderRepo.findById(targetParentId);
      if (!target || target.user_id !== userId) throw new Error('TARGET_FOLDER_NOT_FOUND');
      if (target.is_trashed) throw new Error('TARGET_FOLDER_TRASHED');

      // Circular reference: target tidak boleh merupakan descendant dari folder ini
      const descendants = await folderRepo.findDescendantIds(folderId);
      if (descendants.includes(targetParentId)) throw new Error('CIRCULAR_REFERENCE');
    }

    // Cek duplikat nama di lokasi tujuan
    const duplicate = await folderRepo.existsByName(userId, folder.name, targetParentId, folderId);
    if (duplicate) throw new Error('FOLDER_NAME_EXISTS');

    return await folderRepo.move(folderId, targetParentId);
  }

  // Hapus permanen (beserta semua isi via DB cascade)
  async deletePermanent(userId, folderId, isAdmin = false) {
    const folder = await folderRepo.findById(folderId);
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    if (!isAdmin && folder.user_id !== userId) throw new Error('FOLDER_NOT_FOUND');

    // Hitung total ukuran file dalam folder + subfolder untuk update quota
    const descendantIds = await folderRepo.findDescendantIds(folderId);
    const allFolderIds  = [folderId, ...descendantIds];
    const filesInside   = await fileRepo.findByFolderIds(allFolderIds);
    const totalSize     = filesInside.reduce((sum, f) => sum + Number(f.size), 0);

    // Hapus folder (cascade ke subfolder dan file di DB)
    await folderRepo.deletePermanent(folderId);

    // Update storage_used user
    if (totalSize > 0) {
      const user = await userRepo.findById(userId);
      if (user) {
        const newUsed = Math.max(0, Number(user.storage_used) - totalSize);
        await userRepo.updateStorageUsed(userId, newUsed);
      }
    }

    return { id: folderId, name: folder.name };
  }

  // Bulk restore folders dari trash
  async bulkRestoreFolders(userId, folderIds) {
    const results = { restored: [], failed: [] };

    for (const folderId of folderIds) {
      try {
        const folder = await folderRepo.findById(folderId);
        if (!folder || folder.user_id !== userId) {
          results.failed.push({ id: folderId, reason: 'not_found' });
          continue;
        }
        if (!folder.is_trashed) {
          results.failed.push({ id: folderId, reason: 'not_trashed' });
          continue;
        }
        // Jika nama duplikat di lokasi asal, beri suffix timestamp
        const duplicate = await folderRepo.existsByName(userId, folder.name, folder.parent_id, folderId);
        if (duplicate) {
          const newName = `${folder.name}_restored_${Date.now()}`;
          await folderRepo.update(folderId, { name: newName });
        }
        const restored = await folderRepo.restore(folderId);
        results.restored.push(restored);
      } catch {
        results.failed.push({ id: folderId, reason: 'error' });
      }
    }

    return results;
  }
}
