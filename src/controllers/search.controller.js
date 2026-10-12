import { SearchRepository } from '../repositories/search.repository.js';
import { sendSuccess, sendError } from '../utils/response.js';

const searchRepo = new SearchRepository();

// GET /api/search?q=keyword&limit=10
export const search = async (req, res, next) => {
  try {
    const q     = (req.query.q ?? '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);

    // Minimal 2 karakter
    if (q.length < 2) {
      return sendSuccess(res, { folders: [], files: [], total: 0 });
    }

    const [folders, files] = await Promise.all([
      searchRepo.searchFolders(req.user.id, q, limit),
      searchRepo.searchFiles(req.user.id, q, limit),
    ]);

    return sendSuccess(res, {
      folders,
      files,
      total: folders.length + files.length,
    });
  } catch (e) {
    next(e);
  }
};
