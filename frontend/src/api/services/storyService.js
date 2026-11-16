import { apiClient } from '../client.js';
import { characterService } from './characterService.js';

const collection = '/api/v1/stories';

export const storyService = {
  list: () => apiClient.get(collection),
  listProjects: () => characterService.listProjects(),
  create: (story) => apiClient.post(collection, story),
  updateById: (id, changes) => apiClient.patch(apiClient.resource(collection, id), changes),
  removeById: (id) => apiClient.delete(apiClient.resource(collection, id)),
  get: (endpoint) => apiClient.get(endpoint),
  save: (endpoint, story) => apiClient.put(endpoint, story),
  analyze: (endpoint, requestData) => apiClient.post(endpoint, requestData),
  generateText: (endpoint, requestData) => apiClient.post(endpoint, requestData),
  extractCharacters: (endpoint, requestData) => apiClient.post(endpoint, requestData),
};
