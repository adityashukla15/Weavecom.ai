import { apiClient } from '../client.js';

export const authService = {
  signIn: (endpoint, credentials) => apiClient.post(endpoint, credentials),
  signOut: (endpoint) => apiClient.post(endpoint),
  getProfile: (endpoint) => apiClient.get(endpoint),
};
