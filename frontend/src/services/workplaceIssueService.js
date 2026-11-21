import api from './api';

export const workplaceIssueService = {
  async getIssues(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/workplace-issues', { params: cleaned });
    return response.data.data;
  },

  async getIssue(id) {
    const response = await api.get(`/workplace-issues/${id}`);
    return response.data.data;
  },

  async createIssue(payload) {
    const response = await api.post('/workplace-issues', payload);
    return response.data;
  },

  async updateIssue(id, payload) {
    const response = await api.put(`/workplace-issues/${id}`, payload);
    return response.data;
  },

  async deleteIssue(id) {
    const response = await api.delete(`/workplace-issues/${id}`);
    return response.data;
  },
};
