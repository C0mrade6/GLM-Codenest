const TOKEN_KEY = 'codenest:token';

// Empty in dev/all-in-one mode (same origin + Vite proxy). When the frontend is
// hosted separately (e.g. Vercel), set VITE_API_URL to the backend URL
// (e.g. https://codenest-api.onrender.com).
export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch { /* non-json */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
