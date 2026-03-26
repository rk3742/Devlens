'use strict';

const { Router } = require('express');
const {
  connectRepo,
  getRepo,
  repoBodyValidators,
  validateRequest,
} = require('../controllers/repoController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// All repo routes require an authenticated user
router.use(requireAuth);

/**
 * POST /api/repos/connect
 * Body: { owner: string, repo: string, branch?: string }
 */
router.post('/connect', repoBodyValidators, validateRequest, connectRepo);

/**
 * GET /api/repos/:repoId
 */
router.get('/:repoId', getRepo);

module.exports = router;
