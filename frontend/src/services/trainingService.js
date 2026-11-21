import api from './api';

export const trainingService = {
  async getTrainings(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/trainings', { params: cleaned });
    return response.data.data;
  },

  async getTraining(id) {
    const response = await api.get(`/trainings/${id}`);
    return response.data.data;
  },

  async createTraining(payload) {
    const response = await api.post('/trainings', payload);
    return response.data;
  },

  async updateTraining(id, payload) {
    const response = await api.put(`/trainings/${id}`, payload);
    return response.data;
  },

  async deleteTraining(id) {
    const response = await api.delete(`/trainings/${id}`);
    return response.data;
  },
};
