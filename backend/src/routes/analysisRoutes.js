'use strict';

const { Router } = require('express');
const {
  runAnalysis,
  runFileSummary,
  listJobs,
  getJob,
  runValidators,
  fileSummaryValidators,
  validate,
} = require('../controllers/analysisController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.use(requireAuth);

// Run a repo-level analysis job
router.post('/:repoId/run', runValidators, validate, runAnalysis);

// Summarise a single file
router.post('/:repoId/file-summary', fileSummaryValidators, validate, runFileSummary);

// List all jobs for a repo
router.get('/:repoId/jobs', listJobs);

// Get a specific job result
router.get('/jobs/:jobId', getJob);

module.exports = router;
