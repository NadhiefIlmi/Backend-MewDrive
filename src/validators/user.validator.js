import { body, query, param } from 'express-validator';

// ─── Create User ─────────────────────────────────────────────────────────────
export const createUserValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('role')
    .optional()
    .isIn(['ADMIN', 'USER']).withMessage('Role must be ADMIN or USER'),

  body('storage_quota')
    .optional()
    .isInt({ min: 1 }).withMessage('Storage quota must be a positive integer (bytes)'),
];

// ─── Update User ─────────────────────────────────────────────────────────────
export const updateUserValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('role')
    .optional()
    .isIn(['ADMIN', 'USER']).withMessage('Role must be ADMIN or USER'),
];

// ─── Update Status ────────────────────────────────────────────────────────────
export const updateStatusValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),

  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
];

// ─── Update Storage Quota ─────────────────────────────────────────────────────
export const updateStorageQuotaValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),

  body('storage_quota')
    .notEmpty().withMessage('Storage quota is required')
    .isInt({ min: 1 }).withMessage('Storage quota must be a positive integer (bytes)'),
];

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPasswordValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),

  body('new_password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// ─── Change Own Password (user yang login, butuh password lama) ───────────────
export const changePasswordValidator = [
  body('current_password')
    .notEmpty().withMessage('Password saat ini wajib diisi'),

  body('new_password')
    .notEmpty().withMessage('Password baru wajib diisi')
    .isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('Password baru tidak boleh sama dengan password lama');
      }
      return true;
    }),
];

// ─── List Users (query params) ────────────────────────────────────────────────
export const listUsersValidator = [
  query('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),

  query('role')
    .optional()
    .isIn(['ADMIN', 'USER']).withMessage('Role must be ADMIN or USER'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search term too long'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];
