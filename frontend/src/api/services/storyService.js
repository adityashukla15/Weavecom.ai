import { apiClient } from '../client.js';

export const storyService = {
  get: (endpoint) => apiClient.get(endpoint),
  save: (endpoint, story) => apiClient.put(endpoint, story),
  analyze: (endpoint, requestData) => apiClient.post(endpoint, requestData),
  generateText: (endpoint, requestData) => apiClient.post(endpoint, requestData),
  extractCharacters: (endpoint, requestData) => apiClient.post(endpoint, requestData),
};
