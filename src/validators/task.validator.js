import { body, query as qv } from 'express-validator';

export const createTaskValidator = [
  body('title')
    .trim().notEmpty().withMessage('Title wajib diisi')
    .isLength({ max: 255 }).withMessage('Title maksimal 255 karakter'),
  body('description')
    .optional().isString(),
  body('priority')
    .optional().isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority tidak valid'),
  body('status')
    .optional().isIn(['todo', 'in_progress', 'in_review', 'done'])
    .withMessage('Status tidak valid'),
  body('due_date')
    .optional({ nullable: true }).isISO8601().withMessage('Format due_date tidak valid'),
];

export const updateTaskValidator = [
  body('title')
    .optional().trim().notEmpty()
    .isLength({ max: 255 }).withMessage('Title maksimal 255 karakter'),
  body('description').optional().isString(),
  body('priority')
    .optional().isIn(['low', 'medium', 'high', 'critical']),
  body('status')
    .optional().isIn(['todo', 'in_progress', 'in_review', 'done']),
  body('due_date')
    .optional({ nullable: true }).isISO8601(),
  body('position')
    .optional().isInt({ min: 0 }),
];

export const listTaskValidator = [
  qv('status')
    .optional().isIn(['todo', 'in_progress', 'in_review', 'done']),
  qv('priority')
    .optional().isIn(['low', 'medium', 'high', 'critical']),
  qv('page')
    .optional().isInt({ min: 1 }).toInt(),
  qv('limit')
    .optional().isInt({ min: 1, max: 200 }).toInt(),
];
