import { validationResult } from 'express-validator';
import { sendError } from '../utils/response.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return sendError(
      res, 
      'VALIDATION_ERROR', 
      firstError.msg,
      400
    );
  }
  
  next();
};
