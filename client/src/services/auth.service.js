import { api } from './api.js';

export const authService = {
  login: async (email, password) => api.login(email, password),
  signup: async data => api.signup(data),
  me: async () => api.me(),
  logout: async () => api.logout(),
};
