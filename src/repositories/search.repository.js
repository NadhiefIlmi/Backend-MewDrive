import { query } from '../config/database.js';

export class SearchRepository {

  /**
   * Cari folder milik user berdasarkan keyword (ILIKE, partial match)
   * Tidak include folder yang di-trash
   */
  async searchFolders(userId, keyword, limit = 10) {
    const result = await query(
      `SELECT
         id, user_id, parent_id, name, color, icon,
         is_starred, is_trashed, trashed_at,
         created_at, updated_at
       FROM folders
       WHERE user_id = $1
         AND is_trashed = false
         AND name ILIKE $2
       ORDER BY name ASC
       LIMIT $3`,
      [userId, `%${keyword}%`, limit]
    );
    return result.rows;
  }

  /**
   * Cari file milik user berdasarkan keyword (ILIKE, partial match)
   * Tidak include file yang di-trash
   */
  async searchFiles(userId, keyword, limit = 10) {
    const result = await query(
      `SELECT
         id, user_id, folder_id, name, original_name,
         mime_type, extension, size, storage_path,
         is_starred, is_trashed, trashed_at,
         created_at, updated_at
       FROM files
       WHERE user_id = $1
         AND is_trashed = false
         AND name ILIKE $2
       ORDER BY name ASC
       LIMIT $3`,
      [userId, `%${keyword}%`, limit]
    );
    return result.rows;
  }
}
