import api from './api';

export const taskService = {
  async getTasks(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/tasks', { params: cleaned });
    return response.data.data;
  },

  async getTask(id) {
    const response = await api.get(`/tasks/${id}`);
    return response.data.data;
  },

  async createTask(payload) {
    const response = await api.post('/tasks', payload);
    return response.data;
  },

  async updateTask(id, payload) {
    const response = await api.put(`/tasks/${id}`, payload);
    return response.data;
  },

  async deleteTask(id) {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },
};
