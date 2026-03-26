'use strict';

const { Octokit } = require('@octokit/rest');

/**
 * Creates an authenticated Octokit instance.
 *
 * @param {string} accessToken  - GitHub OAuth or PAT access token for the user
 * @returns {Octokit}
 */
function createOctokitClient(accessToken) {
  if (!accessToken) {
    throw new Error('GitHub access token is required to create an Octokit client');
  }

  return new Octokit({
    auth: accessToken,
    userAgent: 'DevLens-AI/1.0',
    request: {
      timeout: 30_000,
    },
  });
}

module.exports = { createOctokitClient };
