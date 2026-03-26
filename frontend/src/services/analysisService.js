import api from './api';

const BASE = '/analysis';

/**
 * Runs a repo-level analysis job.
 * @param {number} repoId
 * @param {string} type  - e.g. 'architecture_overview'
 */
export async function runAnalysis(repoId, type) {
  const { data } = await api.post(`${BASE}/${repoId}/run`, { type });
  return data.data;
}

/**
 * Summarises a single file.
 * @param {number} repoId
 * @param {string} filePath
 */
export async function runFileSummary(repoId, filePath) {
  const { data } = await api.post(`${BASE}/${repoId}/file-summary`, { filePath });
  return data.data;
}

/**
 * Lists all analysis jobs for a repo.
 * @param {number} repoId
 */
export async function listJobs(repoId) {
  const { data } = await api.get(`${BASE}/${repoId}/jobs`);
  return data.data;
}

/**
 * Gets a specific analysis job.
 * @param {number} jobId
 */
export async function getJob(jobId) {
  const { data } = await api.get(`${BASE}/jobs/${jobId}`);
  return data.data;
}
