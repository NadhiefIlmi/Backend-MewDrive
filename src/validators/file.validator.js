import { body } from 'express-validator';

export const updateFileValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('File name cannot be empty')
    .isLength({ max: 255 }).withMessage('File name must not exceed 255 characters')
    .not().matches(/[/\\<>:"|?*]/).withMessage('File name contains invalid characters'),

  body('is_starred')
    .optional()
    .isBoolean().withMessage('is_starred must be a boolean'),
];

export const moveFileValidator = [
  body('target_folder_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) return true;
      if (Number.isInteger(value) && value > 0) return true;
      throw new Error('target_folder_id must be a positive integer or null');
    }),
];
