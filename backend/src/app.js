'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const repoRoutes = require('./routes/repoRoutes');
const authRoutes = require('./routes/authRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const qaRoutes = require('./routes/qaRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const logger = require('./utils/logger');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/qa', qaRoutes);

// Webhook route: capture raw body BEFORE JSON parsing for HMAC-SHA256 verification
app.use('/webhooks', (req, _res, next) => {
  let data = [];
  req.on('data', (chunk) => data.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(data);
    // Re-parse body from rawBody so req.body is still populated
    try {
      req.body = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      req.body = {};
    }
    next();
  });
}, webhookRoutes);

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => logger.info(`DevLens API listening on port ${PORT}`));
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

start();

module.exports = app; // exported for testing
