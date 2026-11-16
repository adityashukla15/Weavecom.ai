import { apiClient } from '../client.js';

const collection = '/api/v1/assistant';

export const assistantService = {
  listProjects: () => apiClient.get(`${collection}/projects`),
  ask: (projectId, question) => apiClient.post(`${collection}/ask`, {
    project_id: projectId,
    question,
  }),
};
