import { AuthService } from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const result = await this.authService.login(email, password);

      return sendSuccess(res, result, null, 200);
    } catch (error) {
      if (error.message === 'INVALID_CREDENTIALS') {
        return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      if (error.message === 'ACCOUNT_INACTIVE') {
        return sendError(res, 'ACCOUNT_INACTIVE', 'Your account is not active', 403);
      }
      next(error);
    }
  };

  me = async (req, res, next) => {
    try {
      const user = await this.authService.getCurrentUser(req.user.id);

      return sendSuccess(res, user, null, 200);
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      // Teruskan decoded token payload supaya service bisa revoke jti
      await this.authService.logout(req.user.id, req.tokenPayload);

      return sendSuccess(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  };
}
