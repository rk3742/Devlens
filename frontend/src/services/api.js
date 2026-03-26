import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Primary API client – all /api/** routes
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 60_000, // repo ingestion can take a while for large repos
});

// Auth client – routes served at /auth (not under /api)
export const authApi = axios.create({
  baseURL: `${BACKEND_URL}/auth`,
  timeout: 15_000,
});

function attachToken(config) {
  const token = localStorage.getItem('devlens_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

function normaliseError(err) {
  const message =
    err.response?.data?.message ||
    err.response?.data?.error ||
    err.message ||
    'An unexpected error occurred';
  return Promise.reject(new Error(message));
}

api.interceptors.request.use(attachToken);
authApi.interceptors.request.use(attachToken);

api.interceptors.response.use((res) => res, normaliseError);
authApi.interceptors.response.use((res) => res, normaliseError);

export default api;
