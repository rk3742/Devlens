'use strict';

const { body, param, validationResult } = require('express-validator');
const qaService = require('../services/qaService');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
}

/**
 * POST /api/qa/:repoId/sessions
 * Body: { title?: string }
 */
async function createSession(req, res) {
  const repoId = Number(req.params.repoId);
  const userId = req.user.id;
  const { title } = req.body;

  const sessionId = await qaService.createSession(repoId, userId, title);
  return res.status(201).json({ success: true, data: { sessionId } });
}

/**
 * GET /api/qa/:repoId/sessions
 */
async function listSessions(req, res) {
  const repoId = Number(req.params.repoId);
  const sessions = await qaService.listSessions(repoId, req.user.id);
  return res.status(200).json({ success: true, data: sessions });
}

/**
 * GET /api/qa/sessions/:sessionId/messages
 */
async function getMessages(req, res) {
  const sessionId = Number(req.params.sessionId);
  const messages = await qaService.getSessionMessages(sessionId, req.user.id);
  return res.status(200).json({ success: true, data: messages });
}

/**
 * POST /api/qa/sessions/:sessionId/ask
 * Body: { question: string, repoId: number }
 */
async function ask(req, res) {
  const sessionId = Number(req.params.sessionId);
  const userId = req.user.id;
  const { question, repoId } = req.body;

  const { answer } = await qaService.answerQuestion({
    repoId: Number(repoId),
    userId,
    sessionId,
    question,
  });

  return res.status(200).json({ success: true, data: { answer } });
}

const askValidators = [
  body('question').trim().notEmpty().withMessage('question is required').isLength({ max: 2000 }),
  body('repoId').isInt({ min: 1 }).withMessage('repoId must be a positive integer'),
];

module.exports = { createSession, listSessions, getMessages, ask, askValidators, validate };
