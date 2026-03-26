'use strict';

const logger = require('../utils/logger');

/**
 * Global error-handling middleware for Express.
 * Must be registered AFTER all routes (app.use(errorHandler)).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Structured log
  logger.error({
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Determine HTTP status
  const status =
    err.statusCode ||
    err.status ||
    (err.name === 'ValidationError' ? 422 : 500);

  // Octokit / GitHub API errors
  if (err.name === 'HttpError') {
    return res.status(err.status).json({
      success: false,
      message: 'GitHub API error',
      detail: err.message,
    });
  }

  // Don't leak internals to clients in production
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'An internal server error occurred'
      : err.message;

  return res.status(status).json({
    success: false,
    message,
    ...(err.code ? { code: err.code } : {}),
  });
}

/**
 * 404 handler – register before errorHandler, after all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFoundHandler };
