import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Generate JWT token dengan JTI (JWT ID) unik.
 * JTI dipakai untuk token blacklist saat logout.
 *
 * @param {object} payload - Data yang disimpan di token (userId, email, role)
 * @returns {string} JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      jti: crypto.randomBytes(16).toString('hex'), // unique token ID untuk blacklist
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * Verifikasi JWT token.
 * Melempar error 'TOKEN_EXPIRED' atau 'INVALID_TOKEN' jika tidak valid.
 *
 * @param   {string} token
 * @returns {object} decoded payload (termasuk jti, exp, userId, dll)
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    }
    throw error;
  }
};
