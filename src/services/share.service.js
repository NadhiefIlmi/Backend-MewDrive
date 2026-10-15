import { ShareRepository } from '../repositories/share.repository.js';
import { FileRepository } from '../repositories/file.repository.js';

export class ShareService {
  constructor() {
    this.shareRepo = new ShareRepository();
    this.fileRepo  = new FileRepository();
  }

  /**
   * Buat atau return share link yang sudah ada untuk file.
   * Selalu buat baru — satu file bisa punya lebih dari satu link.
   */
  async createShareLink(userId, fileId, expiresAt = null) {
    // Validasi file milik user & tidak di-trash
    const file = await this.fileRepo.findById(fileId);
    if (!file)                   throw new Error('FILE_NOT_FOUND');
    if (file.user_id !== userId) throw new Error('FORBIDDEN');
    if (file.is_trashed)         throw new Error('FILE_TRASHED');

    // Validasi expires_at jika diberikan
    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (isNaN(exp.getTime()) || exp <= new Date()) {
        throw new Error('INVALID_EXPIRES_AT');
      }
    }

    const link = await this.shareRepo.create(fileId, userId, expiresAt || null);
    return { ...link, file_id: fileId };
  }

  /**
   * List semua share link milik user (dengan info file)
   */
  async listShareLinks(userId) {
    return this.shareRepo.findByUser(userId);
  }

  /**
   * Toggle aktif / nonaktif share link
   */
  async toggleShareLink(userId, linkId, isActive) {
    const link = await this.shareRepo.setActive(linkId, userId, isActive);
    if (!link) throw new Error('SHARE_LINK_NOT_FOUND');
    return link;
  }

  /**
   * Hapus share link
   */
  async deleteShareLink(userId, linkId) {
    const deleted = await this.shareRepo.delete(linkId, userId);
    if (!deleted) throw new Error('SHARE_LINK_NOT_FOUND');
    return deleted;
  }

  /**
   * Resolve share link berdasarkan token atau slug (untuk halaman publik).
   * Coba token dulu — kalau tidak ditemukan, fallback ke slug.
   * Tidak butuh auth.
   */
  async resolveToken(identifier) {
    // Coba cari sebagai token hex (32 char hex = token)
    let link = await this.shareRepo.findByToken(identifier);

    // Fallback: coba sebagai slug custom
    if (!link) {
      link = await this.shareRepo.findBySlug(identifier);
    }

    if (!link) throw new Error('SHARE_LINK_NOT_FOUND');
    if (!link.is_active) throw new Error('SHARE_LINK_INACTIVE');
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw new Error('SHARE_LINK_EXPIRED');
    }
    if (link.is_trashed) throw new Error('FILE_TRASHED');
    return link;
  }

  /**
   * Resolve share link berdasarkan slug custom.
   * Tidak butuh auth.
   */
  async resolveSlug(slug) {
    const link = await this.shareRepo.findBySlug(slug);
    if (!link) throw new Error('SHARE_LINK_NOT_FOUND');
    if (!link.is_active) throw new Error('SHARE_LINK_INACTIVE');
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw new Error('SHARE_LINK_EXPIRED');
    }
    if (link.is_trashed) throw new Error('FILE_TRASHED');
    return link;
  }

  /**
   * Set atau hapus slug custom untuk share link.
   */
  async updateSlug(userId, linkId, slug) {
    // Validasi format slug: hanya huruf, angka, strip, underscore; maks 100 char
    if (slug !== null) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(slug)) {
        throw new Error('INVALID_SLUG');
      }
      // Cek duplikat
      const taken = await this.shareRepo.isSlugTaken(slug, linkId);
      if (taken) throw new Error('SLUG_TAKEN');
    }

    const link = await this.shareRepo.updateSlug(linkId, userId, slug);
    if (!link) throw new Error('SHARE_LINK_NOT_FOUND');
    return link;
  }
}
