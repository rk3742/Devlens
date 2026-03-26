'use strict';

const { createOctokitClient } = require('../config/github');
const logger = require('../utils/logger');

const MAX_REPO_SIZE_MB = Number(process.env.MAX_REPO_SIZE_MB) || 500;

/**
 * Fetches repository metadata from GitHub.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Object>} GitHub repository object
 */
async function getRepoMetadata(accessToken, owner, repo) {
  const octokit = createOctokitClient(accessToken);

  const { data } = await octokit.repos.get({ owner, repo });

  const repoSizeMB = data.size / 1024; // GitHub reports in KB
  if (repoSizeMB > MAX_REPO_SIZE_MB) {
    throw Object.assign(
      new Error(`Repository size (${repoSizeMB.toFixed(1)} MB) exceeds the ${MAX_REPO_SIZE_MB} MB limit`),
      { statusCode: 422, code: 'REPO_TOO_LARGE' }
    );
  }

  logger.info(`Fetched metadata for ${owner}/${repo} (${repoSizeMB.toFixed(1)} MB)`);

  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    stargazersCount: data.stargazers_count,
    forksCount: data.forks_count,
    isPrivate: data.private,
    cloneUrl: data.clone_url,
    htmlUrl: data.html_url,
    sizeKb: data.size,
    updatedAt: data.updated_at,
    topics: data.topics || [],
  };
}

/**
 * Fetches the full Git tree for a repository (recursive, single API call).
 * Falls back to the default branch when sha is not supplied.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @param {string} [treeSha]  - commit SHA or branch name
 * @returns {Promise<Array<{path: string, type: string, sha: string, size: number}>>}
 */
async function getRepoTree(accessToken, owner, repo, treeSha) {
  const octokit = createOctokitClient(accessToken);

  // If no SHA supplied, resolve the default branch HEAD
  let ref = treeSha;
  if (!ref) {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    ref = repoData.default_branch;
  }

  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: '1',
  });

  if (data.truncated) {
    logger.warn(`Git tree for ${owner}/${repo} was truncated by GitHub – some files may be missing`);
  }

  return data.tree;
}

/**
 * Fetches raw file content from GitHub via the contents API.
 * GitHub base64-encodes file blobs; this method decodes them transparently.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @param {string} filePath
 * @param {string} [ref]  - branch / tag / commit SHA (defaults to HEAD)
 * @returns {Promise<string>}  UTF-8 decoded file content
 */
async function getFileContent(accessToken, owner, repo, filePath, ref) {
  const octokit = createOctokitClient(accessToken);

  const params = { owner, repo, path: filePath };
  if (ref) params.ref = ref;

  const { data } = await octokit.repos.getContent(params);

  if (data.type !== 'file') {
    throw Object.assign(new Error(`Path "${filePath}" is not a file`), { statusCode: 400 });
  }

  if (data.encoding !== 'base64') {
    throw Object.assign(
      new Error(`Unexpected encoding "${data.encoding}" for file "${filePath}"`),
      { statusCode: 422 }
    );
  }

  return Buffer.from(data.content, 'base64').toString('utf8');
}

/**
 * Fetches multiple files in parallel with a concurrency cap to avoid hitting
 * GitHub's secondary rate limits.
 *
 * @param {string} accessToken
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} filePaths
 * @param {string} [ref]
 * @param {number} [concurrency=5]
 * @returns {Promise<Array<{path: string, content: string}>>}
 */
async function fetchFilesWithConcurrencyLimit(
  accessToken,
  owner,
  repo,
  filePaths,
  ref,
  concurrency = 5
) {
  // Dynamically import p-limit (ESM-only package) via a compatibility shim
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(concurrency);

  const results = await Promise.allSettled(
    filePaths.map((filePath) =>
      limit(async () => {
        const content = await getFileContent(accessToken, owner, repo, filePath, ref);
        return { path: filePath, content };
      })
    )
  );

  const files = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      files.push(result.value);
    } else {
      logger.warn(`Failed to fetch ${filePaths[i]}: ${result.reason.message}`);
    }
  }

  return files;
}

module.exports = {
  getRepoMetadata,
  getRepoTree,
  getFileContent,
  fetchFilesWithConcurrencyLimit,
};
