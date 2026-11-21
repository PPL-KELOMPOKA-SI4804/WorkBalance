import api from './api';

export const departmentService = {
  async getDepartments(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/departments', { params: cleaned });
    return response.data.data;
  },

  async getDepartment(id) {
    const response = await api.get(`/departments/${id}`);
    return response.data.data;
  },

  async createDepartment(payload) {
    const response = await api.post('/departments', payload);
    return response.data;
  },

  async updateDepartment(id, payload) {
    const response = await api.put(`/departments/${id}`, payload);
    return response.data;
  },

  async deleteDepartment(id) {
    const response = await api.delete(`/departments/${id}`);
    return response.data;
  },
};
