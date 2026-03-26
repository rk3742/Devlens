'use strict';

const { handleOAuthCallback } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

/**
 * GET /auth/github
 * Redirects the user to GitHub's OAuth authorization page.
 */
function redirectToGitHub(req, res) {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'repo read:user user:email',
    redirect_uri: `${req.protocol}://${req.get('host')}/auth/github/callback`,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

/**
 * GET /auth/github/callback?code=...
 * Exchanges the OAuth code, issues our JWT, and redirects the SPA
 * with the token embedded in the fragment (never in the query string).
 */
async function githubCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${CLIENT_ORIGIN}/login?error=missing_code`);
  }

  const { token, user } = await handleOAuthCallback(code);

  // Pass token to SPA via URL fragment so it is never sent to the server
  return res.redirect(`${CLIENT_ORIGIN}/auth/callback#token=${token}&username=${user.username}`);
}

/**
 * GET /auth/me
 * Returns the current user's public profile (requires valid JWT).
 */
function getMe(req, res) {
  const { id, username, email, plan } = req.user;
  return res.json({ success: true, data: { id, username, email, plan } });
}

module.exports = { redirectToGitHub, githubCallback, getMe };
