import { apiClient } from '../client.js';

const collection = '/api/v1/projects';

export const projectService = {
  listAccessible: () => apiClient.get(collection),
  createProject: (project) => apiClient.post(collection, project),
  list: (endpoint, query) => apiClient.get(endpoint, query),
  get: (collectionEndpoint, id) => apiClient.get(apiClient.resource(collectionEndpoint, id)),
  create: (endpoint, project) => apiClient.post(endpoint, project),
  update: (collectionEndpoint, id, updates) => apiClient.patch(apiClient.resource(collectionEndpoint, id), updates),
  remove: (collectionEndpoint, id) => apiClient.delete(apiClient.resource(collectionEndpoint, id)),
};
