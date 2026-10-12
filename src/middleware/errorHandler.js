import { config } from '../config/env.js';
import { sendError } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
  if (config.env === 'development') {
    // Development: log full error termasuk stack trace
    console.error('Error:', err);
  } else {
    // Production: log minimal — hanya method, path, status, dan message
    // Tidak log req.body karena bisa berisi password atau data sensitif
    console.error(JSON.stringify({
      level: 'error',
      method: req.method,
      path: req.path,
      message: err.message,
      code: err.code ?? null,
      timestamp: new Date().toISOString(),
    }));
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 'VALIDATION_ERROR', err.message, 400);
  }

  // Handle database errors
  if (err.code === '23505') { // Unique violation
    return sendError(res, 'DUPLICATE_ENTRY', 'Resource already exists', 409);
  }

  if (err.code === '23503') { // Foreign key violation
    return sendError(res, 'INVALID_REFERENCE', 'Referenced resource does not exist', 400);
  }

  if (err.code === '23502') { // Not-null violation
    return sendError(res, 'INVALID_INPUT', 'Required field is missing', 400);
  }

  // Handle PostgreSQL statement_timeout
  // Error code '57014' = query_canceled (ditrigger oleh statement_timeout)
  if (err.code === '57014') {
    return sendError(res, 'QUERY_TIMEOUT', 'Request took too long, please try again', 503);
  }

  // Handle JWT errors
  if (err.message === 'TOKEN_EXPIRED') {
    return sendError(res, 'TOKEN_EXPIRED', 'Token has expired', 401);
  }

  if (err.message === 'INVALID_TOKEN') {
    return sendError(res, 'INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  // Default error — jangan leak stack trace di production
  const message = config.env === 'development'
    ? err.message
    : 'An unexpected error occurred';

  return sendError(res, 'INTERNAL_ERROR', message, 500);
};

export const notFoundHandler = (req, res) => {
  return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
};
