'use strict';

const { Router } = require('express');
const {
  createSession,
  listSessions,
  getMessages,
  ask,
  askValidators,
  validate,
} = require('../controllers/qaController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

// Create a new Q&A session for a repo
router.post('/:repoId/sessions', createSession);

// List sessions for a repo
router.get('/:repoId/sessions', listSessions);

// Get messages in a session
router.get('/sessions/:sessionId/messages', getMessages);

// Ask a question in a session
router.post('/sessions/:sessionId/ask', askValidators, validate, ask);

module.exports = router;
