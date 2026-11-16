import { apiClient } from '../client.js';

export const projectService = {
  list: (endpoint, query) => apiClient.get(endpoint, query),
  get: (collectionEndpoint, id) => apiClient.get(apiClient.resource(collectionEndpoint, id)),
  create: (endpoint, project) => apiClient.post(endpoint, project),
  update: (collectionEndpoint, id, updates) => apiClient.patch(apiClient.resource(collectionEndpoint, id), updates),
  remove: (collectionEndpoint, id) => apiClient.delete(apiClient.resource(collectionEndpoint, id)),
};
