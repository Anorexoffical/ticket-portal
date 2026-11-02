const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: data => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  me: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  dashboard: () => apiRequest('/admin/dashboard'),
  flights: () => apiRequest('/flights'),
  adminFlights: () => apiRequest('/admin/flights'),
};
