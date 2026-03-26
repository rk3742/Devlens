import api from './api';

/**
 * Sends a repository connection + ingestion request to the backend.
 *
 * @param {Object} params
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {string} [params.branch]
 * @returns {Promise<{repoId: number, fileCount: number, chunkCount: number, message: string}>}
 */
export async function connectRepository({ owner, repo, branch }) {
  const { data } = await api.post('/repos/connect', { owner, repo, branch });
  return data.data;
}

/**
 * Fetches summary data for a previously indexed repository.
 *
 * @param {number|string} repoId
 * @returns {Promise<Object>}
 */
export async function getRepository(repoId) {
  const { data } = await api.get(`/repos/${repoId}`);
  return data.data;
}
