import { body, query } from 'express-validator';

const VALID_COLORS = ['bg-sun', 'bg-lime', 'bg-lilac', 'bg-sky', 'bg-coral'];

export const createNoteValidator = [
  body('title')
    .optional({ nullable: true })
    .isString().withMessage('title must be a string')
    .isLength({ max: 255 }).withMessage('title must not exceed 255 characters'),

  body('body')
    .optional({ nullable: true })
    .isString().withMessage('body must be a string'),

  body('color')
    .optional({ nullable: true })
    .isIn(VALID_COLORS).withMessage(`color must be one of: ${VALID_COLORS.join(', ')}`),

  body('is_pinned')
    .optional()
    .isBoolean().withMessage('is_pinned must be a boolean'),
];

export const updateNoteValidator = [
  body('title')
    .optional({ nullable: true })
    .isString().withMessage('title must be a string')
    .isLength({ max: 255 }).withMessage('title must not exceed 255 characters'),

  body('body')
    .optional({ nullable: true })
    .isString().withMessage('body must be a string'),

  body('color')
    .optional({ nullable: true })
    .isIn(VALID_COLORS).withMessage(`color must be one of: ${VALID_COLORS.join(', ')}`),

  body('is_pinned')
    .optional()
    .isBoolean().withMessage('is_pinned must be a boolean'),
];

export const listNotesValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];
