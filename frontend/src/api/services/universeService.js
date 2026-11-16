import { apiClient } from '../client.js';

export const universeService = {
  get: (endpoint) => apiClient.get(endpoint),
  createCharacter: (endpoint, character) => apiClient.post(endpoint, character),
  updateCharacter: (collectionEndpoint, id, updates) => apiClient.patch(apiClient.resource(collectionEndpoint, id), updates),
  createRelationship: (endpoint, relationship) => apiClient.post(endpoint, relationship),
  checkCanon: (endpoint, requestData) => apiClient.post(endpoint, requestData),
};
