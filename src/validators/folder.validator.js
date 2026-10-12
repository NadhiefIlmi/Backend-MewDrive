import { body, query } from 'express-validator';

// Warna folder yang diizinkan
const VALID_COLORS = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange', 'teal', 'gray'];

export const createFolderValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Folder name is required')
    .isLength({ max: 255 }).withMessage('Folder name must not exceed 255 characters')
    .not().matches(/[/\\<>:"|?*]/).withMessage('Folder name contains invalid characters'),

  body('parent_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('parent_id must be a positive integer'),

  body('color')
    .optional({ nullable: true })
    .isIn(VALID_COLORS).withMessage(`Color must be one of: ${VALID_COLORS.join(', ')}`),

  body('icon')
    .optional({ nullable: true })
    .isString().withMessage('icon must be a string')
    .isLength({ max: 50 }).withMessage('icon must not exceed 50 characters'),
];

export const updateFolderValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Folder name cannot be empty')
    .isLength({ max: 255 }).withMessage('Folder name must not exceed 255 characters')
    .not().matches(/[/\\<>:"|?*]/).withMessage('Folder name contains invalid characters'),

  body('color')
    .optional({ nullable: true })
    .isIn([...VALID_COLORS, null]).withMessage(`Color must be one of: ${VALID_COLORS.join(', ')}`),

  body('icon')
    .optional({ nullable: true })
    .isString().withMessage('icon must be a string')
    .isLength({ max: 50 }).withMessage('icon must not exceed 50 characters'),

  body('is_starred')
    .optional()
    .isBoolean().withMessage('is_starred must be a boolean'),
];

export const moveFolderValidator = [
  body('target_parent_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) return true;
      if (Number.isInteger(value) && value > 0) return true;
      throw new Error('target_parent_id must be a positive integer or null');
    }),
];
