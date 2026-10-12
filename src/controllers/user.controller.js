import { UserService } from '../services/user.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const userService = new UserService();

export class UserController {

  // GET /api/users
  listUsers = async (req, res, next) => {
    try {
      const { status, role, search, page, limit } = req.query;
      const result = await userService.getAllUsers({
        status,
        role,
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/users/:id
  getUser = async (req, res, next) => {
    try {
      const user = await userService.getUserById(req.params.id);
      return sendSuccess(res, user);
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      next(error);
    }
  };

  // POST /api/users
  createUser = async (req, res, next) => {
    try {
      const { name, email, password, role, storage_quota } = req.body;
      const user = await userService.createUser({ name, email, password, role, storage_quota });
      return sendSuccess(res, user, 'User created successfully', 201);
    } catch (error) {
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        return sendError(res, 'EMAIL_ALREADY_EXISTS', 'Email is already in use', 409);
      }
      if (error.message === 'ROLE_NOT_FOUND') {
        return sendError(res, 'ROLE_NOT_FOUND', 'Specified role does not exist', 400);
      }
      next(error);
    }
  };

  // PATCH /api/users/:id
  updateUser = async (req, res, next) => {
    try {
      const { name, email, role } = req.body;
      const user = await userService.updateUser(req.params.id, { name, email, role });
      return sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      if (error.message === 'EMAIL_ALREADY_EXISTS') {
        return sendError(res, 'EMAIL_ALREADY_EXISTS', 'Email is already in use', 409);
      }
      if (error.message === 'ROLE_NOT_FOUND') {
        return sendError(res, 'ROLE_NOT_FOUND', 'Specified role does not exist', 400);
      }
      if (error.message === 'LAST_ADMIN') {
        return sendError(res, 'LAST_ADMIN', 'Cannot change role of the last admin', 400);
      }
      next(error);
    }
  };

  // PATCH /api/users/:id/status
  updateStatus = async (req, res, next) => {
    try {
      const user = await userService.updateUserStatus(req.params.id, req.body.status);
      const label = req.body.status === 'active' ? 'enabled' : 'disabled';
      return sendSuccess(res, user, `User ${label} successfully`);
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      if (error.message === 'LAST_ADMIN') {
        return sendError(res, 'LAST_ADMIN', 'Cannot disable the last active admin', 400);
      }
      next(error);
    }
  };

  // PATCH /api/users/:id/storage-quota
  updateStorageQuota = async (req, res, next) => {
    try {
      const user = await userService.updateStorageQuota(
        req.params.id,
        parseInt(req.body.storage_quota)
      );
      return sendSuccess(res, user, 'Storage quota updated successfully');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      if (error.message === 'QUOTA_BELOW_USED') {
        return sendError(
          res,
          'QUOTA_BELOW_USED',
          'Storage quota cannot be less than current storage used',
          400
        );
      }
      next(error);
    }
  };

  // POST /api/users/:id/reset-password
  resetPassword = async (req, res, next) => {
    try {
      await userService.resetPassword(req.params.id, req.body.new_password);
      return sendSuccess(res, null, 'Password reset successfully');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      next(error);
    }
  };

  // DELETE /api/users/:id
  deleteUser = async (req, res, next) => {
    try {
      const deleted = await userService.deleteUser(req.params.id, req.user.id);
      return sendSuccess(res, deleted, 'User deleted successfully');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      if (error.message === 'LAST_ADMIN') {
        return sendError(res, 'LAST_ADMIN', 'Cannot delete the last admin', 400);
      }
      if (error.message === 'CANNOT_DELETE_SELF') {
        return sendError(res, 'CANNOT_DELETE_SELF', 'You cannot delete your own account', 400);
      }
      next(error);
    }
  };

  // GET /api/roles
  listRoles = async (req, res, next) => {
    try {
      const roles = await userService.getAllRoles();
      return sendSuccess(res, roles);
    } catch (error) {
      next(error);
    }
  };
}
