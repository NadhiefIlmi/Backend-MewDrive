import { verifyToken } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PermissionService } from '../services/permission.service.js';
import { TokenRepository } from '../repositories/token.repository.js';

const userRepository = new UserRepository();
const permissionService = new PermissionService();
const tokenRepository = new TokenRepository();

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Support token via query string untuk download links
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const decoded = verifyToken(token);

    // Cek apakah token sudah di-revoke (logout sebelumnya)
    if (decoded.jti) {
      const revoked = await tokenRepository.isRevoked(decoded.jti);
      if (revoked) {
        return sendError(res, 'UNAUTHORIZED', 'Token has been revoked', 401);
      }
    }

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'User not found', 401);
    }

    if (user.status !== 'active') {
      return sendError(res, 'FORBIDDEN', 'Account is not active', 403);
    }

    // Simpan decoded token di request supaya logout bisa ambil jti + exp
    req.tokenPayload = decoded;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_name
    };

    next();
  } catch (error) {
    if (error.message === 'TOKEN_EXPIRED' || error.message === 'INVALID_TOKEN') {
      return sendError(res, error.message, 'Invalid or expired token', 401);
    }
    next(error);
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403);
    }
    next();
  };
};

/**
 * Middleware untuk cek permission spesifik.
 * Dipakai di routes yang butuh permission tertentu, bukan hanya role.
 *
 * Contoh:
 *   router.post('/files', authenticate, requirePermission('create_files'), handler)
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    try {
      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        permissionName
      );

      if (!hasPermission) {
        return sendError(
          res,
          'FORBIDDEN',
          `Permission denied: ${permissionName}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
