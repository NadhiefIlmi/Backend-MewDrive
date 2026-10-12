import { PermissionService } from '../services/permission.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const permissionService = new PermissionService();

export class PermissionController {

  // GET /api/permissions
  listPermissions = async (req, res, next) => {
    try {
      const permissions = await permissionService.getAllPermissions();
      return sendSuccess(res, permissions);
    } catch (error) {
      next(error);
    }
  };

  // GET /api/users/:id/permissions
  getUserPermissions = async (req, res, next) => {
    try {
      const permissions = await permissionService.getUserPermissions(req.params.id);
      return sendSuccess(res, permissions);
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      next(error);
    }
  };

  // PUT /api/users/:id/permissions
  setUserPermissions = async (req, res, next) => {
    try {
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return sendError(res, 'VALIDATION_ERROR', 'permissions must be an array of permission names', 400);
      }
      const result = await permissionService.setUserPermissions(req.params.id, permissions);
      return sendSuccess(res, result, 'Permissions updated successfully');
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }
      if (error.message?.startsWith('INVALID_PERMISSIONS')) {
        return sendError(res, 'INVALID_PERMISSIONS', error.message, 400);
      }
      next(error);
    }
  };
}
