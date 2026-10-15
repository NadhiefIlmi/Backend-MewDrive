import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository.js';
import { config } from '../config/env.js';

const userRepository = new UserRepository();

export class UserService {

  // ─── List & Detail ────────────────────────────────────────────────────────

  async getAllUsers({ status, role, search, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const { users, total } = await userRepository.findAll({ status, role, search, limit, offset });

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id) {
    const user = await userRepository.getUserWithoutPassword(id);
    if (!user) throw new Error('USER_NOT_FOUND');
    return user;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createUser({ name, email, password, role, storage_quota }) {
    // Cek duplikat email
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new Error('EMAIL_ALREADY_EXISTS');

    // Resolve role → role_id
    const roleRecord = await userRepository.findRoleByName(role || 'USER');
    if (!roleRecord) throw new Error('ROLE_NOT_FOUND');

    const password_hash = await bcrypt.hash(password, config.security.bcryptRounds);

    const created = await userRepository.create({
      name,
      email,
      password_hash,
      role_id: roleRecord.id,
      storage_quota: storage_quota ?? 107374182400, // 100 GB default
    });

    // Kembalikan dengan role name (bukan role_id)
    return await userRepository.getUserWithoutPassword(created.id);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateUser(id, { name, email, role }) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Cek duplikat email jika email berubah
    if (email && email.toLowerCase() !== user.email) {
      const existing = await userRepository.findByEmail(email);
      if (existing) throw new Error('EMAIL_ALREADY_EXISTS');
    }

    let role_id;
    if (role) {
      const roleRecord = await userRepository.findRoleByName(role);
      if (!roleRecord) throw new Error('ROLE_NOT_FOUND');

      // Jangan turunkan role ADMIN jika dia satu-satunya
      if (user.role_name === 'ADMIN' && role.toUpperCase() !== 'ADMIN') {
        const adminCount = await userRepository.countByRole('ADMIN');
        if (adminCount <= 1) throw new Error('LAST_ADMIN');
      }

      role_id = roleRecord.id;
    }

    await userRepository.update(id, { name, email, role_id });
    return await userRepository.getUserWithoutPassword(id);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(id, newPassword) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    const password_hash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await userRepository.updatePassword(id, password_hash);
  }

  // ─── Change Own Password (user yang login, verifikasi password lama) ──────

  async changePassword(id, currentPassword, newPassword) {
    // Ambil user BESERTA password_hash-nya untuk verifikasi
    const user = await userRepository.findByIdWithPassword(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Verifikasi password lama
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new Error('WRONG_CURRENT_PASSWORD');

    const password_hash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await userRepository.updatePassword(id, password_hash);
  }

  // ─── Enable / Disable ─────────────────────────────────────────────────────

  async updateUserStatus(id, status) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Jangan nonaktifkan ADMIN terakhir
    if (user.role_name === 'ADMIN' && status === 'inactive') {
      const activeAdminCount = await userRepository.countByRole('ADMIN', 'active');
      if (activeAdminCount <= 1) throw new Error('LAST_ADMIN');
    }

    return await userRepository.updateStatus(id, status);
  }

  // ─── Storage Quota ────────────────────────────────────────────────────────

  async updateStorageQuota(id, storage_quota) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Quota tidak boleh lebih kecil dari storage yang sudah dipakai
    if (storage_quota < user.storage_used) {
      throw new Error('QUOTA_BELOW_USED');
    }

    return await userRepository.updateStorageQuota(id, storage_quota);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteUser(id, requesterId) {
    if (parseInt(id) === parseInt(requesterId)) {
      throw new Error('CANNOT_DELETE_SELF');
    }

    const user = await userRepository.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Jangan hapus ADMIN terakhir
    if (user.role_name === 'ADMIN') {
      const adminCount = await userRepository.countByRole('ADMIN');
      if (adminCount <= 1) throw new Error('LAST_ADMIN');
    }

    return await userRepository.delete(id);
  }

  // ─── Roles ────────────────────────────────────────────────────────────────

  async getAllRoles() {
    return await userRepository.findAllRoles();
  }
}
