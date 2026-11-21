import api from './api';

export const employeeService = {
  async getEmployees(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/employees', { params: cleaned });
    return response.data.data;
  },

  async createEmployee(payload) {
    const response = await api.post('/employees', payload);
    return response.data;
  },

  async updateEmployee(id, payload) {
    const response = await api.put(`/employees/${id}`, payload);
    return response.data;
  },

  async deleteEmployee(id) {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },

  async getEmploymentTypes() {
    const response = await api.get('/employment-types');
    return response.data.data;
  },

  async createEmploymentType(payload) {
    const response = await api.post('/employment-types', payload);
    return response.data;
  },

  async updateEmploymentType(id, payload) {
    const response = await api.put(`/employment-types/${id}`, payload);
    return response.data;
  },

  async deleteEmploymentType(id) {
    const response = await api.delete(`/employment-types/${id}`);
    return response.data;
  },

  async getDepartments() {
    const response = await api.get('/departments');
    return response.data.data;
  },

  async getPositions() {
    const response = await api.get('/positions');
    return response.data.data;
  },
};
