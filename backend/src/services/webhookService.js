'use strict';

/**
 * webhookService.js
 *
 * Handles GitHub webhook events (currently: pull_request opened/synchronize).
 * Verifies HMAC-SHA256 signatures, fetches the PR diff, runs AI review,
 * posts a review comment back to GitHub, and persists the result.
 */

const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const { getPool } = require('../config/database');
const { generateJSON, PROMPTS } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Validates the `x-hub-signature-256` header against the raw request body.
 *
 * @param {Buffer} rawBody   - raw request body buffer
 * @param {string} signature - header value from GitHub
 * @returns {boolean}
 */
function verifySignature(rawBody, signature) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('GITHUB_WEBHOOK_SECRET not set – skipping signature verification');
    return true;
  }
  if (!signature) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Fetches the diff for a pull request.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @returns {Promise<string>} unified diff text
 */
async function getPullRequestDiff(accessToken, owner, repo, pullNumber) {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: { format: 'diff' },
  });
  return String(data);
}

/**
 * Posts a review comment to a GitHub pull request.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @param {Object} reviewResult  - structured AI review JSON
 * @returns {Promise<void>}
 */
async function postPRReview(accessToken, owner, repo, pullNumber, reviewResult) {
  const octokit = new Octokit({ auth: accessToken });

  const verdictMap = {
    approve: 'APPROVE',
    request_changes: 'REQUEST_CHANGES',
    comment: 'COMMENT',
  };

  const event = verdictMap[reviewResult.verdict] || 'COMMENT';
  const body = formatReviewBody(reviewResult);

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event,
    body,
  });
}

/**
 * Converts the AI review JSON into a human-readable GitHub markdown comment.
 *
 * @param {Object} review
 * @returns {string}
 */
function formatReviewBody(review) {
  const lines = ['## 🤖 DevLens AI Review\n'];

  lines.push(`**Summary:** ${review.summary}\n`);

  if (review.positives?.length) {
    lines.push('### ✅ Positives');
    review.positives.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }

  if (review.issues?.length) {
    lines.push('### ⚠️ Issues Found');
    review.issues.forEach((issue) => {
      const sev = issue.severity.toUpperCase();
      lines.push(`\n**[${sev}] ${issue.type}** – \`${issue.file}\` (${issue.line})`);
      lines.push(`> ${issue.description}`);
      if (issue.suggestion) lines.push(`\n💡 ${issue.suggestion}`);
    });
    lines.push('');
  }

  if (review.suggested_tests?.length) {
    lines.push('### 🧪 Suggested Tests');
    review.suggested_tests.forEach((t) => lines.push(`- ${t}`));
    lines.push('');
  }

  lines.push('---\n*This review was generated automatically by [DevLens AI](https://github.com/rk3742/Devlens).*');
  return lines.join('\n');
}

/**
 * Main webhook handler for pull_request events.
 *
 * @param {Object} payload  - parsed GitHub webhook payload
 * @returns {Promise<void>}
 */
async function handlePullRequestEvent(payload) {
  const { action, pull_request: pr, repository } = payload;

  // Only act on opened or new commits pushed
  if (!['opened', 'synchronize', 'reopened'].includes(action)) return;

  const owner = repository.owner.login;
  const repo = repository.name;
  const pullNumber = pr.number;
  const prTitle = pr.title;
  const prBody = pr.body;

  logger.info(`[webhook] PR #${pullNumber} ${action} in ${owner}/${repo}`);

  const pool = getPool();

  // Find a user who has connected this repo so we can use their token
  const [[repoRow]] = await pool.execute(
    `SELECT r.id AS repoId, u.access_token AS accessToken, u.id AS userId
     FROM repositories r
     JOIN users u ON u.id = r.user_id
     WHERE r.owner = ? AND r.name = ?
     ORDER BY r.updated_at DESC
     LIMIT 1`,
    [owner, repo]
  );

  if (!repoRow) {
    logger.warn(`[webhook] No indexed repo found for ${owner}/${repo}`);
    return;
  }

  const diff = await getPullRequestDiff(repoRow.accessToken, owner, repo, pullNumber);
  const prompt = PROMPTS.prReview(prTitle, prBody, diff);
  const reviewResult = await generateJSON(prompt);

  // Persist the review
  await pool.execute(
    `INSERT INTO pr_reviews
       (repo_id, pull_number, pr_title, verdict, result, posted_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       verdict   = VALUES(verdict),
       result    = VALUES(result),
       posted_at = NOW()`,
    [
      repoRow.repoId,
      pullNumber,
      prTitle,
      reviewResult.verdict || 'comment',
      JSON.stringify(reviewResult),
    ]
  );

  // Post the review back to GitHub
  await postPRReview(repoRow.accessToken, owner, repo, pullNumber, reviewResult);

  logger.info(`[webhook] Review posted for PR #${pullNumber} in ${owner}/${repo}`);
}

module.exports = { verifySignature, handlePullRequestEvent, formatReviewBody };
