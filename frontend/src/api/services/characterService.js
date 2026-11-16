import { apiClient } from '../client.js';

const collection = '/api/v1/characters';

export const characterService = {
  list: () => apiClient.get(collection),
  listProjects: () => apiClient.get(`${collection}/projects`),
  get: (id) => apiClient.get(apiClient.resource(collection, id)),
  create: (character) => apiClient.post(collection, character),
  update: (id, changes) => apiClient.patch(apiClient.resource(collection, id), changes),
  remove: (id) => apiClient.delete(apiClient.resource(collection, id)),
};
