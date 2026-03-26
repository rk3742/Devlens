'use strict';

const { Router } = require('express');
const {
  connectRepo,
  getRepo,
  listRepos,
  listPRReviews,
  repoBodyValidators,
  validateRequest,
} = require('../controllers/repoController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// All repo routes require an authenticated user
router.use(requireAuth);

/**
 * GET /api/repos
 * Returns all indexed repositories for the authenticated user.
 */
router.get('/', listRepos);

/**
 * POST /api/repos/connect
 * Body: { owner: string, repo: string, branch?: string }
 */
router.post('/connect', repoBodyValidators, validateRequest, connectRepo);

/**
 * GET /api/repos/:repoId
 */
router.get('/:repoId', getRepo);

/**
 * GET /api/repos/:repoId/pr-reviews
 */
router.get('/:repoId/pr-reviews', listPRReviews);

module.exports = router;
