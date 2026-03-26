'use strict';

const { Octokit } = require('@octokit/rest');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

/**
 * Exchanges a GitHub OAuth code for an access token.
 *
 * @param {string} code  - code from GitHub callback query param
 * @returns {Promise<string>} GitHub access token
 */
async function exchangeCodeForToken(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw Object.assign(
      new Error(`GitHub OAuth error: ${data.error_description || data.error}`),
      { statusCode: 401 }
    );
  }

  return data.access_token;
}

/**
 * Fetches the authenticated GitHub user profile.
 *
 * @param {string} accessToken
 * @returns {Promise<Object>} GitHub user object
 */
async function getGitHubUser(accessToken) {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.users.getAuthenticated();
  return data;
}

/**
 * Upserts the GitHub user into our DB and returns our internal user record.
 *
 * @param {Object} ghUser  - GitHub user object
 * @param {string} accessToken
 * @returns {Promise<{id: number, username: string, email: string|null, avatarUrl: string|null, plan: string}>}
 */
async function upsertUser(ghUser, accessToken) {
  const pool = getPool();

  await pool.execute(
    `INSERT INTO users (github_id, username, email, avatar_url, access_token)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username     = VALUES(username),
       email        = VALUES(email),
       avatar_url   = VALUES(avatar_url),
       access_token = VALUES(access_token),
       updated_at   = NOW()`,
    [
      ghUser.id,
      ghUser.login,
      ghUser.email || null,
      ghUser.avatar_url || null,
      accessToken,
    ]
  );

  const [[user]] = await pool.execute(
    'SELECT id, username, email, avatar_url, plan FROM users WHERE github_id = ?',
    [ghUser.id]
  );

  logger.info(`User ${user.username} (id=${user.id}) authenticated via GitHub`);
  return user;
}

/**
 * Signs a JWT containing the user's id, username, and GitHub access token.
 *
 * @param {{id: number, username: string, email: string|null, plan: string}} user
 * @param {string} githubAccessToken
 * @returns {string}
 */
function signJwt(user, githubAccessToken) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      plan: user.plan,
      githubAccessToken,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Full OAuth callback flow: exchange code → fetch user → upsert → sign JWT.
 *
 * @param {string} code
 * @returns {Promise<{token: string, user: Object}>}
 */
async function handleOAuthCallback(code) {
  const accessToken = await exchangeCodeForToken(code);
  const ghUser = await getGitHubUser(accessToken);
  const user = await upsertUser(ghUser, accessToken);
  const token = signJwt(user, accessToken);
  return { token, user };
}

module.exports = { handleOAuthCallback, signJwt, getGitHubUser };
