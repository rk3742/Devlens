'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { githubWebhook } = require('../controllers/webhookController');

const router = Router();

// Limit webhook delivery rate to protect against replay floods
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // GitHub sends at most a few events per second per repo
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests.' },
});

// GitHub sends a POST with JSON body + signature header
router.post('/github', webhookLimiter, githubWebhook);

module.exports = router;
