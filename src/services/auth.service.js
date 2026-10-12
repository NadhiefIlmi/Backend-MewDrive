import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository.js';
import { TokenRepository } from '../repositories/token.repository.js';
import { generateToken } from '../utils/jwt.js';
import { config } from '../config/env.js';

export class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.tokenRepository = new TokenRepository();
  }

  async login(email, password) {
    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    // Always use the same error message to prevent user enumeration
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new Error('ACCOUNT_INACTIVE');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate JWT token (includes jti)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role_name
    });

    // Return user data (without password) and token
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        storage_quota: user.storage_quota,
        storage_used: user.storage_used,
      },
      token
    };
  }

  async getCurrentUser(userId) {
    const user = await this.userRepository.getUserWithoutPassword(userId);
    
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return user;
  }

  /**
   * Logout — revoke token di blacklist.
   * Token tidak bisa dipakai lagi sampai expired.
   *
   * @param {number} userId       - ID user
   * @param {object} tokenPayload - Decoded JWT payload (berisi jti + exp)
   */
  async logout(userId, tokenPayload) {
    if (tokenPayload?.jti && tokenPayload?.exp) {
      const expiresAt = new Date(tokenPayload.exp * 1000); // exp adalah Unix timestamp (detik)
      await this.tokenRepository.revoke(tokenPayload.jti, userId, expiresAt);
    }
    return { success: true };
  }
}
