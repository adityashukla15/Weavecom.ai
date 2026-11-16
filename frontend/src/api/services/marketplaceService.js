import { apiClient } from '../client.js';

export const marketplaceService = {
  listListings: (endpoint, query) => apiClient.get(endpoint, query),
  getListing: (collectionEndpoint, id) => apiClient.get(apiClient.resource(collectionEndpoint, id)),
  apply: (endpoint, application) => apiClient.post(endpoint, application),
};
