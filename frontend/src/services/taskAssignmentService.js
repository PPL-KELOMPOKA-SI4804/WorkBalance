import api from './api';

export const taskAssignmentService = {
  async getTaskAssignments(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/task-assignments', { params: cleaned });
    return response.data.data;
  },

  async getTaskAssignment(id) {
    const response = await api.get(`/task-assignments/${id}`);
    return response.data.data;
  },

  async createTaskAssignment(payload) {
    const response = await api.post('/task-assignments', payload);
    return response.data;
  },

  async updateTaskAssignment(id, payload) {
    const response = await api.put(`/task-assignments/${id}`, payload);
    return response.data;
  },

  async deleteTaskAssignment(id) {
    const response = await api.delete(`/task-assignments/${id}`);
    return response.data;
  },
};
