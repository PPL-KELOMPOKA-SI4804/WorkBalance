import api from './api';

export const trainingParticipationService = {
  async getTrainingParticipations(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/training-participations', { params: cleaned });
    return response.data.data;
  },

  async getTrainingParticipation(id) {
    const response = await api.get(`/training-participations/${id}`);
    return response.data.data;
  },

  async createTrainingParticipation(payload) {
    const response = await api.post('/training-participations', payload);
    return response.data;
  },

  async updateTrainingParticipation(id, payload) {
    const response = await api.put(`/training-participations/${id}`, payload);
    return response.data;
  },

  async deleteTrainingParticipation(id) {
    const response = await api.delete(`/training-participations/${id}`);
    return response.data;
  },
};
