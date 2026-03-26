'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { redirectToGitHub, githubCallback, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Stricter rate limit for authentication endpoints to prevent brute-force / abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

// Initiate GitHub OAuth flow
router.get('/github', authLimiter, redirectToGitHub);

// GitHub redirects back here with ?code=...
router.get('/github/callback', authLimiter, githubCallback);

// Returns the authenticated user's profile
router.get('/me', authLimiter, requireAuth, getMe);

module.exports = router;
