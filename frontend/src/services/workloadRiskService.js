import api from './api';

export const workloadRiskService = {
  async getWorkloadRisks(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/analytics/workload-risk', { params: cleaned });
    return response.data.data;
  },

  async getWorkloadRisk(id) {
    const response = await api.get(`/analytics/workload-risk/${id}`);
    return response.data.data;
  },

  async recalculateWorkloadRisks(payload = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.post('/analytics/workload-risk', cleaned);
    return response.data;
  },
};
