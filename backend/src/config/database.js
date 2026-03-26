'use strict';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool;

/**
 * Returns a singleton MySQL connection pool.
 * Reads all config from environment variables so the same module
 * works across dev / staging / production without code changes.
 */
function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+00:00',
    charset: 'utf8mb4',
  });

  pool.on('connection', () => {
    logger.debug('MySQL: new connection established');
  });

  return pool;
}

/**
 * Verifies that the database is reachable. Call once at startup.
 */
async function testConnection() {
  const conn = await getPool().getConnection();
  await conn.ping();
  conn.release();
  logger.info('MySQL: connection pool is healthy');
}

module.exports = { getPool, testConnection };
