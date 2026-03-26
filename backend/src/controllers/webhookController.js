'use strict';

const { verifySignature, handlePullRequestEvent } = require('../services/webhookService');
const logger = require('../utils/logger');

/**
 * POST /webhooks/github
 *
 * Receives GitHub webhook events. Express must be configured to expose the
 * raw body buffer on req.rawBody for HMAC verification (see app.js).
 */
async function githubWebhook(req, res) {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  // Always respond quickly to avoid GitHub retries
  if (!verifySignature(req.rawBody, signature)) {
    logger.warn('[webhook] Invalid signature – rejecting request');
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // Acknowledge immediately; process asynchronously
  res.status(200).json({ success: true, message: 'Webhook received' });

  try {
    if (event === 'pull_request') {
      await handlePullRequestEvent(req.body);
    }
    // Future events (push, issues, etc.) can be added here
  } catch (err) {
    logger.error(`[webhook] Error handling ${event} event: ${err.message}`);
  }
}

module.exports = { githubWebhook };
