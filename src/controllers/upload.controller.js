import path from 'path';
import fs from 'fs/promises';
import { FileRepository } from '../repositories/file.repository.js';
import { FolderRepository } from '../repositories/folder.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { cache } from '../utils/cache.js';

const fileRepo   = new FileRepository();
const folderRepo = new FolderRepository();
const userRepo   = new UserRepository();

/**
 * POST /api/files/upload
 * Body (multipart/form-data):
 *   file       — file to upload (required)
 *   folder_id  — target folder id (optional, null = root)
 */
export const uploadFile = async (req, res, next) => {
  const multerFile = req.file;

  // Multer tidak menyimpan file jika fileFilter reject — handle manual
  if (!multerFile) {
    return sendError(res, 'NO_FILE', 'No file provided', 400);
  }

  try {
    const userId   = req.user.id;
    const folderId = req.body.folder_id ? Number(req.body.folder_id) : null;

    // ─── 1. Validasi folder milik user ──────────────────────────────────────
    if (folderId) {
      const folder = await folderRepo.findById(folderId);
      if (!folder || folder.user_id !== userId) {
        await fs.unlink(multerFile.path).catch(() => {});
        return sendError(res, 'FOLDER_NOT_FOUND', 'Folder not found', 404);
      }
      if (folder.is_trashed) {
        await fs.unlink(multerFile.path).catch(() => {});
        return sendError(res, 'FOLDER_TRASHED', 'Cannot upload to a trashed folder', 400);
      }
    }

    // ─── 2. Cek storage quota ────────────────────────────────────────────────
    const user = await userRepo.findById(userId);
    const usedBytes  = Number(user.storage_used);
    const quotaBytes = Number(user.storage_quota);
    const fileSize   = multerFile.size;

    if (usedBytes + fileSize > quotaBytes) {
      await fs.unlink(multerFile.path).catch(() => {});
      return sendError(res, 'QUOTA_EXCEEDED', 'Storage quota exceeded', 400);
    }

    // ─── 3. Resolve nama unik dalam folder ──────────────────────────────────
    const ext          = path.extname(multerFile.originalname);
    const baseName     = path.basename(multerFile.originalname, ext);
    let displayName    = multerFile.originalname;
    let counter        = 1;

    while (await fileRepo.existsByName(userId, displayName, folderId)) {
      displayName = `${baseName} (${counter})${ext}`;
      counter++;
    }

    // ─── 4. Simpan metadata ke DB ────────────────────────────────────────────
    const fileRecord = await fileRepo.create({
      userId,
      folderId,
      name:         displayName,
      originalName: multerFile.originalname,
      mimeType:     multerFile.mimetype,
      extension:    ext.replace('.', '').toLowerCase(),
      size:         fileSize,
      storagePath:  multerFile.path,
    });

    // ─── 5. Update storage_used user ────────────────────────────────────────
    await userRepo.updateStorageUsed(userId, usedBytes + fileSize);

    // Invalidate storage cache user ini — quota sudah berubah
    cache.del(`storage:${userId}`);

    return sendSuccess(res, fileRecord, 'File uploaded successfully', 201);
  } catch (error) {
    // Cleanup file fisik jika ada error
    if (multerFile?.path) {
      await fs.unlink(multerFile.path).catch(() => {});
    }
    next(error);
  }
};
