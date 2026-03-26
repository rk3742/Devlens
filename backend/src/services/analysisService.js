'use strict';

/**
 * analysisService.js
 *
 * Orchestrates all AI-powered analysis jobs:
 *   - architecture_overview
 *   - file_summary
 *   - data_flow
 *   - start_here
 *   - complexity
 *   - dead_code
 *   - circular_deps
 *   - security_scan
 *   - tech_debt
 *
 * Each job is persisted as an `analysis_jobs` row so the UI can poll for status.
 */

const { getPool } = require('../config/database');
const { generateJSON, buildCodeContext, PROMPTS } = require('./aiService');
const logger = require('../utils/logger');

const VALID_JOB_TYPES = [
  'architecture_overview',
  'file_summary',
  'data_flow',
  'start_here',
  'complexity',
  'dead_code',
  'circular_deps',
  'security_scan',
  'tech_debt',
];

/**
 * Fetches a batch of file chunks from the DB for a given repo.
 * Limits token count to avoid context overflow.
 *
 * @param {number} repoId
 * @param {number} [maxTokens=60000]
 * @returns {Promise<Array<{filePath: string, content: string}>>}
 */
async function getChunksForRepo(repoId, maxTokens = 60_000) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT file_path AS filePath, content, estimated_tokens
     FROM file_chunks
     WHERE repo_id = ?
     ORDER BY file_path, chunk_index`,
    [repoId]
  );

  // Greedily collect chunks up to the token budget
  const selected = [];
  let total = 0;
  for (const row of rows) {
    if (total + row.estimated_tokens > maxTokens) break;
    selected.push({ filePath: row.filePath, content: row.content });
    total += row.estimated_tokens;
  }

  return selected;
}

/**
 * Creates an analysis job record and returns its id.
 *
 * @param {number} repoId
 * @param {number} userId
 * @param {string} type
 * @returns {Promise<number>} job id
 */
async function createJob(repoId, userId, type) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO analysis_jobs (repo_id, user_id, type, status)
     VALUES (?, ?, ?, 'queued')`,
    [repoId, userId, type]
  );
  return result.insertId;
}

/**
 * Marks a job as running / completed / failed and persists the result.
 *
 * @param {number} jobId
 * @param {'running'|'completed'|'failed'} status
 * @param {Object|null} result
 * @param {string|null} error
 */
async function updateJob(jobId, status, result = null, error = null) {
  const pool = getPool();
  const updates = { status };
  if (status === 'running') updates.started_at = new Date();
  if (status === 'completed' || status === 'failed') updates.finished_at = new Date();
  if (result) updates.result = JSON.stringify(result);
  if (error) updates.error = error;

  await pool.execute(
    `UPDATE analysis_jobs
     SET status = ?, result = ?, error = ?,
         started_at  = COALESCE(?, started_at),
         finished_at = COALESCE(?, finished_at)
     WHERE id = ?`,
    [
      updates.status,
      updates.result || null,
      updates.error || null,
      updates.started_at || null,
      updates.finished_at || null,
      jobId,
    ]
  );
}

/**
 * Runs one analysis job end-to-end:
 *   create → queue → run → persist result.
 *
 * @param {Object} params
 * @param {number} params.repoId
 * @param {number} params.userId
 * @param {string} params.type
 * @param {string} params.repoName   - for prompt context
 * @returns {Promise<{jobId: number, result: Object}>}
 */
async function runAnalysis({ repoId, userId, type, repoName }) {
  if (!VALID_JOB_TYPES.includes(type)) {
    throw Object.assign(new Error(`Unknown analysis type: ${type}`), { statusCode: 422 });
  }

  // Verify the repo is indexed
  const pool = getPool();
  const [[repo]] = await pool.execute(
    "SELECT id, full_name, status FROM repositories WHERE id = ? AND user_id = ?",
    [repoId, userId]
  );

  if (!repo) throw Object.assign(new Error('Repository not found'), { statusCode: 404 });
  if (repo.status !== 'indexed') {
    throw Object.assign(
      new Error(`Repository is not indexed yet (status: ${repo.status})`),
      { statusCode: 422 }
    );
  }

  const jobId = await createJob(repoId, userId, type);
  await updateJob(jobId, 'running');

  try {
    const chunks = await getChunksForRepo(repoId);
    const codeContext = buildCodeContext(chunks);
    const name = repoName || repo.full_name;

    let prompt;
    switch (type) {
      case 'architecture_overview': prompt = PROMPTS.architectureOverview(name, codeContext); break;
      case 'data_flow':             prompt = PROMPTS.dataFlow(name, codeContext); break;
      case 'start_here':            prompt = PROMPTS.startHere(name, codeContext); break;
      case 'complexity':            prompt = PROMPTS.complexity(codeContext); break;
      case 'dead_code':             prompt = PROMPTS.deadCode(codeContext); break;
      case 'circular_deps':         prompt = PROMPTS.circularDeps(codeContext); break;
      case 'security_scan':         prompt = PROMPTS.securityScan(codeContext); break;
      case 'tech_debt':             prompt = PROMPTS.techDebt(codeContext); break;
      default:
        throw new Error(`Unhandled analysis type: ${type}`);
    }

    logger.info(`[analysis] Running ${type} for repo ${repoId} (job ${jobId})`);
    const result = await generateJSON(prompt);

    await updateJob(jobId, 'completed', result);
    logger.info(`[analysis] Job ${jobId} (${type}) completed`);

    return { jobId, result };
  } catch (err) {
    await updateJob(jobId, 'failed', null, err.message);
    logger.error(`[analysis] Job ${jobId} failed: ${err.message}`);
    throw err;
  }
}

/**
 * Runs file_summary for a single file path.
 *
 * @param {Object} params
 * @param {number} params.repoId
 * @param {number} params.userId
 * @param {string} params.filePath
 * @returns {Promise<{jobId: number, result: Object}>}
 */
async function runFileSummary({ repoId, userId, filePath }) {
  const pool = getPool();

  // Verify ownership
  const [[repo]] = await pool.execute(
    'SELECT id FROM repositories WHERE id = ? AND user_id = ?',
    [repoId, userId]
  );
  if (!repo) throw Object.assign(new Error('Repository not found'), { statusCode: 404 });

  // Fetch all chunks for this file
  const [rows] = await pool.execute(
    `SELECT content FROM file_chunks
     WHERE repo_id = ? AND file_path = ?
     ORDER BY chunk_index`,
    [repoId, filePath]
  );

  if (!rows.length) {
    throw Object.assign(new Error(`File "${filePath}" not found in index`), { statusCode: 404 });
  }

  const fileContent = rows.map((r) => r.content).join('');
  const jobId = await createJob(repoId, userId, 'file_summary');
  await updateJob(jobId, 'running');

  try {
    const result = await generateJSON(PROMPTS.fileSummary(filePath, fileContent));
    await updateJob(jobId, 'completed', result);
    return { jobId, result };
  } catch (err) {
    await updateJob(jobId, 'failed', null, err.message);
    throw err;
  }
}

/**
 * Fetches a previously completed analysis job result.
 *
 * @param {number} jobId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getJobResult(jobId, userId) {
  const pool = getPool();
  const [[job]] = await pool.execute(
    `SELECT j.id, j.type, j.status, j.result, j.error, j.started_at, j.finished_at, j.created_at
     FROM analysis_jobs j
     JOIN repositories r ON r.id = j.repo_id
     WHERE j.id = ? AND r.user_id = ?`,
    [jobId, userId]
  );

  if (!job) return null;

  return {
    ...job,
    result: job.result ? JSON.parse(job.result) : null,
  };
}

/**
 * Lists all analysis jobs for a repository.
 *
 * @param {number} repoId
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function listJobs(repoId, userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT j.id, j.type, j.status, j.error, j.started_at, j.finished_at, j.created_at
     FROM analysis_jobs j
     JOIN repositories r ON r.id = j.repo_id
     WHERE j.repo_id = ? AND r.user_id = ?
     ORDER BY j.created_at DESC`,
    [repoId, userId]
  );
  return rows;
}

module.exports = { runAnalysis, runFileSummary, getJobResult, listJobs };
