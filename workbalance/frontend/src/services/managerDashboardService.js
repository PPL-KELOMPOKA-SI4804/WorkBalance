import api from './api';

export const managerDashboardService = {
  async getDashboardSummary(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/dashboard/manager', { params: cleaned });
    return response.data.data;
  },
};
