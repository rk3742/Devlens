'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Express middleware that validates a Bearer JWT and attaches
 * the decoded payload to req.user.
 *
 * Expected token payload shape:
 * {
 *   id: number,
 *   username: string,
 *   email: string|null,        // null if user has no public email on GitHub
 *   plan: string,
 *   githubAccessToken: string,
 * }
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }
}

module.exports = { requireAuth };
