'use strict';

const { body, param, validationResult } = require('express-validator');
const repoService = require('../services/repoService');
const logger = require('../utils/logger');

/**
 * Validation rules reused across routes.
 */
const repoBodyValidators = [
  body('owner')
    .trim()
    .notEmpty()
    .withMessage('owner is required')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('owner contains invalid characters'),
  body('repo')
    .trim()
    .notEmpty()
    .withMessage('repo is required')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('repo contains invalid characters'),
  body('branch')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9_./\-]+$/)
    .withMessage('branch contains invalid characters'),
];

/**
 * Middleware that turns express-validator errors into a 422 response.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * POST /api/repos/connect
 *
 * Validates the incoming request, kicks off the ingestion pipeline,
 * and returns a summary of the indexed repository.
 */
async function connectRepo(req, res) {
  const { owner, repo, branch } = req.body;
  // req.user is set by the auth middleware (JWT)
  const userId = req.user.id;
  const accessToken = req.user.githubAccessToken;

  logger.info(`User ${userId} connecting repo ${owner}/${repo}`);

  const result = await repoService.ingestRepository({
    userId,
    accessToken,
    owner,
    repoName: repo,
    branch,
  });

  return res.status(200).json({
    success: true,
    data: {
      repoId: result.repoId,
      fullName: `${owner}/${repo}`,
      fileCount: result.fileCount,
      chunkCount: result.chunkCount,
      message: `Repository ${owner}/${repo} successfully indexed`,
    },
  });
}

/**
 * GET /api/repos/:repoId
 *
 * Returns metadata + file/chunk counts for a repository the user owns.
 */
async function getRepo(req, res) {
  const repoId = Number(req.params.repoId);
  const userId = req.user.id;

  const repo = await repoService.getRepoSummary(repoId, userId);

  if (!repo) {
    return res.status(404).json({ success: false, message: 'Repository not found' });
  }

  return res.status(200).json({ success: true, data: repo });
}

module.exports = {
  connectRepo,
  getRepo,
  repoBodyValidators,
  validateRequest,
};
