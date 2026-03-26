import api from './api';

const BASE = '/qa';

export async function createSession(repoId, title) {
  const { data } = await api.post(`${BASE}/${repoId}/sessions`, { title });
  return data.data;
}

export async function listSessions(repoId) {
  const { data } = await api.get(`${BASE}/${repoId}/sessions`);
  return data.data;
}

export async function getMessages(sessionId) {
  const { data } = await api.get(`${BASE}/sessions/${sessionId}/messages`);
  return data.data;
}

export async function askQuestion(sessionId, repoId, question) {
  const { data } = await api.post(`${BASE}/sessions/${sessionId}/ask`, { repoId, question });
  return data.data;
}
