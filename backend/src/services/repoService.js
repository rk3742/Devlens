'use strict';

/**
 * repoService.js
 *
 * Orchestrates the full repository ingestion pipeline:
 *   1. Fetch metadata
 *   2. Fetch Git tree
 *   3. Filter files
 *   4. Download file contents (with concurrency control)
 *   5. Drop binary content
 *   6. Build AI chunks
 *   7. Persist to DB
 */

const githubService = require('./githubService');
const { filterTree, isLikelyBinaryContent } = require('./fileParserService');
const { buildChunks } = require('./chunkingService');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Full ingestion pipeline for a repository.
 *
 * @param {Object} params
 * @param {number} params.userId         - authenticated user's DB id
 * @param {string} params.accessToken    - GitHub access token
 * @param {string} params.owner          - GitHub org / username
 * @param {string} params.repoName       - repository name
 * @param {string} [params.branch]       - optional branch / tag / SHA (defaults to default branch)
 * @returns {Promise<{repoId: number, fileCount: number, chunkCount: number}>}
 */
async function ingestRepository({ userId, accessToken, owner, repoName, branch }) {
  logger.info(`[ingest] Starting ingestion for ${owner}/${repoName} (user ${userId})`);

  // ── 1. Metadata ──────────────────────────────────────────────────────────
  const metadata = await githubService.getRepoMetadata(accessToken, owner, repoName);

  // ── 2. Upsert repo record ─────────────────────────────────────────────────
  const pool = getPool();
  const [insertResult] = await pool.execute(
    `INSERT INTO repositories
       (user_id, github_id, owner, name, full_name, description,
        default_branch, language, is_private, html_url, size_kb, topics, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'indexing')
     ON DUPLICATE KEY UPDATE
       description   = VALUES(description),
       default_branch = VALUES(default_branch),
       language      = VALUES(language),
       is_private    = VALUES(is_private),
       size_kb       = VALUES(size_kb),
       topics        = VALUES(topics),
       status        = 'indexing',
       updated_at    = NOW()`,
    [
      userId,
      metadata.id,
      owner,
      metadata.name,
      metadata.fullName,
      metadata.description || null,
      metadata.defaultBranch,
      metadata.language || null,
      metadata.isPrivate ? 1 : 0,
      metadata.htmlUrl,
      metadata.sizeKb,
      JSON.stringify(metadata.topics),
    ]
  );

  // MySQL returns insertId for INSERT, 0 for ON DUPLICATE KEY UPDATE
  let repoId = insertResult.insertId;
  if (!repoId) {
    const [[existing]] = await pool.execute(
      'SELECT id FROM repositories WHERE user_id = ? AND github_id = ?',
      [userId, metadata.id]
    );
    repoId = existing.id;
  }

  try {
    // ── 3. Git tree ───────────────────────────────────────────────────────────
    const rawTree = await githubService.getRepoTree(accessToken, owner, repoName, branch);
    const filteredFiles = filterTree(rawTree);

    logger.info(`[ingest] ${owner}/${repoName}: ${filteredFiles.length} files after filtering`);

    // ── 4. Fetch file contents ────────────────────────────────────────────────
    const filePaths = filteredFiles.map((f) => f.path);
    const resolvedBranch = branch || metadata.defaultBranch;

    const fileContents = await githubService.fetchFilesWithConcurrencyLimit(
      accessToken,
      owner,
      repoName,
      filePaths,
      resolvedBranch,
      5 // concurrency
    );

    // ── 5. Drop binary content ────────────────────────────────────────────────
    const textFiles = fileContents.filter(({ content }) => !isLikelyBinaryContent(content));
    logger.info(`[ingest] ${textFiles.length} text files after binary filter`);

    // ── 6. Persist files & build chunks ──────────────────────────────────────
    // Clear stale data for this repo before re-indexing
    await pool.execute('DELETE FROM file_chunks WHERE repo_id = ?', [repoId]);
    await pool.execute('DELETE FROM repo_files WHERE repo_id = ?', [repoId]);

    const chunks = buildChunks(textFiles);

    // Batch-insert files
    for (const { path: filePath, content } of textFiles) {
      await pool.execute(
        `INSERT INTO repo_files (repo_id, path, size_bytes, line_count)
         VALUES (?, ?, ?, ?)`,
        [repoId, filePath, Buffer.byteLength(content, 'utf8'), content.split('\n').length]
      );
    }

    // Batch-insert chunks (groups of 100 to avoid overly large queries)
    const BATCH = 100;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values = slice.flatMap((c) => [
        repoId,
        c.filePath,
        c.chunkIndex,
        c.totalChunks,
        c.content,
        c.estimatedTokens,
      ]);
      await pool.execute(
        `INSERT INTO file_chunks
           (repo_id, file_path, chunk_index, total_chunks, content, estimated_tokens)
         VALUES ${placeholders}`,
        values
      );
    }

    // ── 7. Mark repo as indexed ───────────────────────────────────────────────
    await pool.execute(
      "UPDATE repositories SET status = 'indexed', indexed_at = NOW() WHERE id = ?",
      [repoId]
    );

    logger.info(`[ingest] Done: repoId=${repoId}, files=${textFiles.length}, chunks=${chunks.length}`);

    return { repoId, fileCount: textFiles.length, chunkCount: chunks.length };
  } catch (err) {
    await pool.execute(
      "UPDATE repositories SET status = 'error' WHERE id = ?",
      [repoId]
    );
    throw err;
  }
}

/**
 * Returns summary information for a previously ingested repository.
 *
 * @param {number} repoId
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getRepoSummary(repoId, userId) {
  const pool = getPool();
  const [[repo]] = await pool.execute(
    `SELECT r.*,
            COUNT(DISTINCT f.id) AS file_count,
            COUNT(c.id)          AS chunk_count
     FROM repositories r
     LEFT JOIN repo_files f ON f.repo_id = r.id
     LEFT JOIN file_chunks c ON c.repo_id = r.id
     WHERE r.id = ? AND r.user_id = ?
     GROUP BY r.id`,
    [repoId, userId]
  );

  return repo || null;
}

/**
 * Returns all repositories for a user, sorted by most recently updated.
 *
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function listUserRepos(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT r.id, r.owner, r.name, r.full_name, r.description, r.language,
            r.is_private, r.status, r.indexed_at, r.updated_at,
            COUNT(DISTINCT f.id) AS file_count,
            COUNT(c.id)          AS chunk_count
     FROM repositories r
     LEFT JOIN repo_files  f ON f.repo_id = r.id
     LEFT JOIN file_chunks c ON c.repo_id = r.id
     WHERE r.user_id = ?
     GROUP BY r.id
     ORDER BY r.updated_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Returns all AI-generated PR reviews for a repository.
 *
 * @param {number} repoId
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function listPRReviews(repoId, userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT pr.id, pr.pull_number, pr.pr_title, pr.verdict, pr.result, pr.posted_at, pr.created_at
     FROM pr_reviews pr
     JOIN repositories r ON r.id = pr.repo_id
     WHERE pr.repo_id = ? AND r.user_id = ?
     ORDER BY pr.created_at DESC`,
    [repoId, userId]
  );
  return rows.map((row) => ({
    ...row,
    result: row.result ? JSON.parse(row.result) : null,
  }));
}

module.exports = { ingestRepository, getRepoSummary, listUserRepos, listPRReviews };
