import { apiClient } from '../client.js';

export const communityService = {
  listPosts: (endpoint, query) => apiClient.get(endpoint, query),
  createPost: (endpoint, post) => apiClient.post(endpoint, post),
  like: (endpoint, action) => apiClient.post(endpoint, action),
  follow: (endpoint, action) => apiClient.post(endpoint, action),
};
