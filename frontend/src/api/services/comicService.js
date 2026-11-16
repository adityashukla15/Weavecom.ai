import { apiClient } from '../client.js';

export const comicService = {
  get: (endpoint) => apiClient.get(endpoint),
  save: (endpoint, comic) => apiClient.put(endpoint, comic),
  export: (endpoint, exportOptions) => apiClient.post(endpoint, exportOptions),
  uploadAsset: (endpoint, file, fieldName = 'file') => {
    const body = new FormData();
    body.append(fieldName, file);
    return apiClient.post(endpoint, body);
  },
  generateImage: (endpoint, generationOptions) => apiClient.post(endpoint, generationOptions),
};
