// frontend/js/api.js

// In dev: frontend is served from :3000, backend from :5000 → cross-origin.
// In prod: frontend is served BY the backend → same-origin → relative URLs.
const API_BASE = (() => {
  // If served by our own backend (prod), location.port is the backend's port
  // and there's no need for an absolute URL.
  const isLocalDev = /^http:\/\/localhost:3000$/.test(window.location.origin)
    || /^http:\/\/127\.0\.0\.1:3000$/.test(window.location.origin);

  return isLocalDev ? 'http://localhost:5000' : '';
})();

// ---------- Token storage helpers ----------
const TOKEN_KEY = 'tm_token';
const USER_KEY = 'tm_user';

const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clearUser: () => localStorage.removeItem(USER_KEY),

  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// ---------- Fetch wrapper ----------
async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = storage.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try to parse JSON, but tolerate empty responses
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    // If unauthorized, clear session so UI can redirect to login
    if (res.status === 401) storage.clearAll();
    throw new Error(message);
  }

  return data;
}

// ---------- API surface ----------
const api = {
  // Auth
  register: (email, password) =>
    apiFetch('/api/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) =>
    apiFetch('/api/auth/login',    { method: 'POST', body: { email, password }, auth: false }),
  me: () => apiFetch('/api/auth/me'),

  // Tasks
  listTasks: () => apiFetch('/api/tasks'),
  createTask: (title, description) =>
    apiFetch('/api/tasks', { method: 'POST', body: { title, description } }),
  updateTask: (id, patch) =>
    apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: patch }),
  deleteTask: (id) =>
    apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Health (no auth)
  health: () => apiFetch('/health', { auth: false }),
};