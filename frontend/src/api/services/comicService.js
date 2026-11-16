import { apiClient } from '../client.js';

const collection = '/api/v1/comics';

export const comicService = {
  list: () => apiClient.get(collection),
  get: (id) => apiClient.get(apiClient.resource(collection, id)),
  create: (comic) => apiClient.post(collection, comic),
  update: (id, changes) => apiClient.patch(apiClient.resource(collection, id), changes),
  remove: (id) => apiClient.delete(apiClient.resource(collection, id)),
  createPanel: (comicId, panel) => apiClient.post(`${apiClient.resource(collection, comicId)}/panels`, panel),
  updatePanel: (comicId, panelId, changes) => apiClient.patch(`${apiClient.resource(collection, comicId)}/panels/${encodeURIComponent(panelId)}`, changes),
  deletePanel: (comicId, panelId) => apiClient.delete(`${apiClient.resource(collection, comicId)}/panels/${encodeURIComponent(panelId)}`),
  reorderPanels: (comicId, panelIds) => apiClient.patch(`${apiClient.resource(collection, comicId)}/panels/reorder`, { panel_ids: panelIds }),
  createBubble: (comicId, panelId, bubble) => apiClient.post(`${apiClient.resource(collection, comicId)}/panels/${encodeURIComponent(panelId)}/bubbles`, bubble),
  updateBubble: (comicId, panelId, bubbleId, changes) => apiClient.patch(`${apiClient.resource(collection, comicId)}/panels/${encodeURIComponent(panelId)}/bubbles/${encodeURIComponent(bubbleId)}`, changes),
  deleteBubble: (comicId, panelId, bubbleId) => apiClient.delete(`${apiClient.resource(collection, comicId)}/panels/${encodeURIComponent(panelId)}/bubbles/${encodeURIComponent(bubbleId)}`),
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
