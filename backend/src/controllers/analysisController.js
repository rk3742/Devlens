'use strict';

const { body, param, query, validationResult } = require('express-validator');
const analysisService = require('../services/analysisService');

const VALID_TYPES = [
  'architecture_overview', 'data_flow', 'start_here',
  'complexity', 'dead_code', 'circular_deps', 'security_scan', 'tech_debt',
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
}

/**
 * POST /api/analysis/:repoId/run
 * Body: { type: string }
 */
async function runAnalysis(req, res) {
  const repoId = Number(req.params.repoId);
  const { type } = req.body;
  const userId = req.user.id;

  const { jobId, result } = await analysisService.runAnalysis({
    repoId,
    userId,
    type,
    repoName: req.body.repoName,
  });

  return res.status(200).json({ success: true, data: { jobId, type, result } });
}

/**
 * POST /api/analysis/:repoId/file-summary
 * Body: { filePath: string }
 */
async function runFileSummary(req, res) {
  const repoId = Number(req.params.repoId);
  const { filePath } = req.body;
  const userId = req.user.id;

  const { jobId, result } = await analysisService.runFileSummary({ repoId, userId, filePath });

  return res.status(200).json({ success: true, data: { jobId, result } });
}

/**
 * GET /api/analysis/:repoId/jobs
 */
async function listJobs(req, res) {
  const repoId = Number(req.params.repoId);
  const jobs = await analysisService.listJobs(repoId, req.user.id);
  return res.status(200).json({ success: true, data: jobs });
}

/**
 * GET /api/analysis/jobs/:jobId
 */
async function getJob(req, res) {
  const jobId = Number(req.params.jobId);
  const job = await analysisService.getJobResult(jobId, req.user.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  return res.status(200).json({ success: true, data: job });
}

const runValidators = [
  body('type').isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
];
const fileSummaryValidators = [
  body('filePath').trim().notEmpty().withMessage('filePath is required'),
];

module.exports = { runAnalysis, runFileSummary, listJobs, getJob, runValidators, fileSummaryValidators, validate };
