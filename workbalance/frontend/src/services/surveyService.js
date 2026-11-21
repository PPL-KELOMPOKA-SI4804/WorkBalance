import api from './api';

export const surveyService = {
  async getSurveys(params = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    );
    const response = await api.get('/surveys', { params: cleaned });
    return response.data.data;
  },

  async getSurvey(id) {
    const response = await api.get(`/surveys/${id}`);
    return response.data.data;
  },

  async createSurvey(payload) {
    const response = await api.post('/surveys', payload);
    return response.data;
  },

  async updateSurvey(id, payload) {
    const response = await api.put(`/surveys/${id}`, payload);
    return response.data;
  },

  async deleteSurvey(id) {
    const response = await api.delete(`/surveys/${id}`);
    return response.data;
  },

  async submitResponse(surveyId, payload) {
    const response = await api.post(`/surveys/${surveyId}/responses`, payload);
    return response.data;
  },

  async updateResponse(surveyId, payload) {
    const response = await api.put(`/surveys/${surveyId}/responses`, payload);
    return response.data;
  },
};
