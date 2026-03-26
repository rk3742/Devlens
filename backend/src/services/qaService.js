'use strict';

/**
 * qaService.js
 *
 * Natural language Q&A over an indexed codebase.
 * Retrieves relevant chunks from the DB, assembles a context window,
 * sends the question to Gemini, and persists the conversation.
 */

const { getPool } = require('../config/database');
const { generateText, buildCodeContext, PROMPTS } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Retrieves the most relevant file chunks for a question.
 * Simple keyword-based relevance: counts how many words from the question
 * appear in the chunk's file path + content.
 *
 * This is a lightweight approach that works without a vector DB.
 * For production scale, replace with an embedding-based similarity search.
 *
 * @param {number} repoId
 * @param {string} question
 * @param {number} [maxTokens=30000]
 * @returns {Promise<Array<{filePath: string, content: string}>>}
 */
async function getRelevantChunks(repoId, question, maxTokens = 30_000) {
  const pool = getPool();
  const [allChunks] = await pool.execute(
    `SELECT file_path AS filePath, content, estimated_tokens
     FROM file_chunks WHERE repo_id = ?
     ORDER BY file_path, chunk_index`,
    [repoId]
  );

  // Score each chunk by keyword overlap with the question
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = allChunks.map((chunk) => {
    const text = (chunk.filePath + ' ' + chunk.content).toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    return { ...chunk, score };
  });

  // Sort by relevance descending, then collect up to token budget
  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let total = 0;
  for (const chunk of scored) {
    if (total + chunk.estimated_tokens > maxTokens) break;
    selected.push({ filePath: chunk.filePath, content: chunk.content });
    total += chunk.estimated_tokens;
  }

  return selected;
}

/**
 * Answers a question about a repository using Gemini.
 * Persists the question + answer to the qa_messages table.
 *
 * @param {Object} params
 * @param {number} params.repoId
 * @param {number} params.userId
 * @param {number} params.sessionId   - id of the qa_sessions row
 * @param {string} params.question
 * @returns {Promise<{answer: string, messageId: number}>}
 */
async function answerQuestion({ repoId, userId, sessionId, question }) {
  const pool = getPool();

  // Verify ownership
  const [[repo]] = await pool.execute(
    'SELECT id, status FROM repositories WHERE id = ? AND user_id = ?',
    [repoId, userId]
  );
  if (!repo) throw Object.assign(new Error('Repository not found'), { statusCode: 404 });
  if (repo.status !== 'indexed') {
    throw Object.assign(
      new Error(`Repository is not indexed yet (status: ${repo.status})`),
      { statusCode: 422 }
    );
  }

  const chunks = await getRelevantChunks(repoId, question);
  const codeContext = buildCodeContext(chunks);

  logger.info(`[qa] Answering question for repo ${repoId}, session ${sessionId}`);
  const prompt = PROMPTS.codeQA(question, codeContext);
  const answer = await generateText(prompt);

  // Persist
  const [result] = await pool.execute(
    `INSERT INTO qa_messages (session_id, role, content) VALUES (?, 'user', ?)`,
    [sessionId, question]
  );
  await pool.execute(
    `INSERT INTO qa_messages (session_id, role, content) VALUES (?, 'assistant', ?)`,
    [sessionId, answer]
  );

  // Update session updated_at
  await pool.execute(
    'UPDATE qa_sessions SET updated_at = NOW() WHERE id = ?',
    [sessionId]
  );

  return { answer, messageId: result.insertId };
}

/**
 * Creates a new Q&A session for a repository.
 *
 * @param {number} repoId
 * @param {number} userId
 * @param {string} title
 * @returns {Promise<number>} session id
 */
async function createSession(repoId, userId, title) {
  const pool = getPool();
  const [result] = await pool.execute(
    'INSERT INTO qa_sessions (repo_id, user_id, title) VALUES (?, ?, ?)',
    [repoId, userId, title || 'New conversation']
  );
  return result.insertId;
}

/**
 * Lists all Q&A sessions for a repo.
 *
 * @param {number} repoId
 * @param {number} userId
 */
async function listSessions(repoId, userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            COUNT(m.id) AS message_count
     FROM qa_sessions s
     LEFT JOIN qa_messages m ON m.session_id = s.id
     WHERE s.repo_id = ? AND s.user_id = ?
     GROUP BY s.id
     ORDER BY s.updated_at DESC`,
    [repoId, userId]
  );
  return rows;
}

/**
 * Returns all messages in a session.
 *
 * @param {number} sessionId
 * @param {number} userId
 */
async function getSessionMessages(sessionId, userId) {
  const pool = getPool();
  // Verify ownership via join
  const [rows] = await pool.execute(
    `SELECT m.id, m.role, m.content, m.created_at
     FROM qa_messages m
     JOIN qa_sessions s ON s.id = m.session_id
     WHERE m.session_id = ? AND s.user_id = ?
     ORDER BY m.created_at ASC`,
    [sessionId, userId]
  );
  return rows;
}

module.exports = { answerQuestion, createSession, listSessions, getSessionMessages };
