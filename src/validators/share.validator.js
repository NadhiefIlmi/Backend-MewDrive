import { body } from 'express-validator';

export const createShareLinkValidator = [
  body('file_id')
    .notEmpty().withMessage('file_id is required')
    .isInt({ min: 1 }).withMessage('file_id must be a positive integer'),

  body('expires_at')
    .optional({ nullable: true })
    .isISO8601().withMessage('expires_at must be a valid ISO 8601 date')
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error('expires_at must be in the future');
      }
      return true;
    }),
];
