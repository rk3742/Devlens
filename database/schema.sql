-- DevLens AI – Database Schema
-- Requires MySQL 8.0+
-- Run as: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS devlens_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE devlens_db;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  github_id          BIGINT UNSIGNED NOT NULL UNIQUE,
  username           VARCHAR(255)    NOT NULL,
  email              VARCHAR(255),
  avatar_url         TEXT,
  access_token       TEXT            NOT NULL,  -- encrypted GitHub OAuth token
  plan               ENUM('free', 'pro', 'enterprise') NOT NULL DEFAULT 'free',
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_github_id (github_id)
) ENGINE=InnoDB;

-- ── Repositories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repositories (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  github_id      BIGINT UNSIGNED NOT NULL,
  owner          VARCHAR(255)    NOT NULL,
  name           VARCHAR(255)    NOT NULL,
  full_name      VARCHAR(512)    NOT NULL,
  description    TEXT,
  default_branch VARCHAR(255)    NOT NULL DEFAULT 'main',
  language       VARCHAR(100),
  is_private     TINYINT(1)      NOT NULL DEFAULT 0,
  html_url       TEXT,
  size_kb        INT UNSIGNED    NOT NULL DEFAULT 0,
  topics         JSON,
  status         ENUM('pending', 'indexing', 'indexed', 'error') NOT NULL DEFAULT 'pending',
  indexed_at     DATETIME,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_github (user_id, github_id),
  CONSTRAINT fk_repo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ── Repo files ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repo_files (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repo_id     BIGINT UNSIGNED NOT NULL,
  path        VARCHAR(1024)   NOT NULL,
  size_bytes  INT UNSIGNED    NOT NULL DEFAULT 0,
  line_count  INT UNSIGNED    NOT NULL DEFAULT 0,
  language    VARCHAR(100),
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_file_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE,
  INDEX idx_repo_id (repo_id),
  INDEX idx_path (repo_id, path(255))
) ENGINE=InnoDB;

-- ── File chunks (for AI processing) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_chunks (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repo_id           BIGINT UNSIGNED NOT NULL,
  file_path         VARCHAR(1024)   NOT NULL,
  chunk_index       SMALLINT UNSIGNED NOT NULL,
  total_chunks      SMALLINT UNSIGNED NOT NULL,
  content           MEDIUMTEXT      NOT NULL,
  estimated_tokens  INT UNSIGNED    NOT NULL DEFAULT 0,
  embedding         JSON,           -- optional: store vector embedding
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chunk_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE,
  INDEX idx_chunk_repo (repo_id),
  INDEX idx_chunk_file (repo_id, file_path(255))
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

-- ── Analysis jobs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repo_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        ENUM(
                'architecture_overview',
                'file_summary',
                'data_flow',
                'start_here',
                'complexity',
                'dead_code',
                'circular_deps',
                'security_scan',
                'tech_debt',
                'pr_review'
              ) NOT NULL,
  status      ENUM('queued', 'running', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  result      LONGTEXT,           -- JSON result from Gemini
  error       TEXT,
  started_at  DATETIME,
  finished_at DATETIME,
  created_at  DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE,
  CONSTRAINT fk_job_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_job_repo (repo_id),
  INDEX idx_job_user (user_id),
  INDEX idx_job_status (status)
) ENGINE=InnoDB;

-- ── PR reviews ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pr_reviews (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repo_id      BIGINT UNSIGNED NOT NULL,
  pull_number  INT UNSIGNED    NOT NULL,
  pr_title     VARCHAR(512),
  verdict      ENUM('approve', 'request_changes', 'comment') NOT NULL DEFAULT 'comment',
  result       LONGTEXT,         -- full JSON review object
  posted_at    DATETIME,
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_repo_pr (repo_id, pull_number),
  CONSTRAINT fk_review_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE,
  INDEX idx_review_repo (repo_id)
) ENGINE=InnoDB;

-- ── Q&A sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_sessions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repo_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(512)    NOT NULL DEFAULT 'New conversation',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_repo FOREIGN KEY (repo_id) REFERENCES repositories (id) ON DELETE CASCADE,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_session_repo (repo_id),
  INDEX idx_session_user (user_id)
) ENGINE=InnoDB;

-- ── Q&A messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  role       ENUM('user', 'assistant') NOT NULL,
  content    MEDIUMTEXT      NOT NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_message_session FOREIGN KEY (session_id) REFERENCES qa_sessions (id) ON DELETE CASCADE,
  INDEX idx_message_session (session_id)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
