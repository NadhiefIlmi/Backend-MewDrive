import { PermissionRepository } from '../repositories/permission.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

const permissionRepository = new PermissionRepository();
const userRepository = new UserRepository();

export class PermissionService {

  // List semua permission yang tersedia
  async getAllPermissions() {
    return await permissionRepository.findAll();
  }

  // Permission yang sudah di-resolve untuk user (role default + override)
  async getUserPermissions(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const resolved = await permissionRepository.resolveForUser(userId);
    // Hanya kembalikan yang granted=true
    return resolved.filter(p => p.granted);
  }

  /**
   * Set permission untuk user.
   * permissionNames = array nama permission yang DIBERIKAN ke user.
   * Permission yang tidak ada di array = dicabut.
   */
  async setUserPermissions(userId, permissionNames) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Validasi semua permission name valid
    const allPerms = await permissionRepository.findAll();
    const validNames = new Set(allPerms.map(p => p.name));
    const invalid = permissionNames.filter(n => !validNames.has(n));
    if (invalid.length > 0) {
      throw new Error(`INVALID_PERMISSIONS: ${invalid.join(', ')}`);
    }

    await permissionRepository.replaceUserPermissions(
      userId,
      user.role_id,
      permissionNames
    );

    // Kembalikan state terbaru
    return await this.getUserPermissions(userId);
  }

  // Cek apakah user punya permission tertentu (dipakai middleware)
  async hasPermission(userId, permissionName) {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some(p => p.name === permissionName);
  }
}
