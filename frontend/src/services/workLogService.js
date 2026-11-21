import api from './api';

export const workLogService = {
  async getWorkLogs(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/work-logs', { params: cleaned });
    return response.data.data;
  },

  async getWorkLog(id) {
    const response = await api.get(`/work-logs/${id}`);
    return response.data.data;
  },

  async createWorkLog(payload) {
    const response = await api.post('/work-logs', payload);
    return response.data;
  },

  async updateWorkLog(id, payload) {
    const response = await api.put(`/work-logs/${id}`, payload);
    return response.data;
  },

  async deleteWorkLog(id) {
    const response = await api.delete(`/work-logs/${id}`);
    return response.data;
  },
};
