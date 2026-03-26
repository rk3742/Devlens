import api from './api';

/**
 * Sends a repository connection + ingestion request to the backend.
 */
export async function connectRepository({ owner, repo, branch }) {
  const { data } = await api.post('/repos/connect', { owner, repo, branch });
  return data.data;
}

/**
 * Fetches all repositories indexed by the current user.
 * @returns {Promise<Array>}
 */
export async function listRepositories() {
  const { data } = await api.get('/repos');
  return data.data;
}

/**
 * Fetches summary data for a previously indexed repository.
 * @param {number|string} repoId
 */
export async function getRepository(repoId) {
  const { data } = await api.get(`/repos/${repoId}`);
  return data.data;
}

/**
 * Fetches all AI-generated PR reviews for a repository.
 * @param {number|string} repoId
 * @returns {Promise<Array>}
 */
export async function listPRReviews(repoId) {
  const { data } = await api.get(`/repos/${repoId}/pr-reviews`);
  return data.data;
}

