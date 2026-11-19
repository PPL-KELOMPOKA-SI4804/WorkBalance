import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'wb_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Extract readable error message and field errors from Laravel API responses.
 */
export function extractApiError(error, fallbackMessage = 'Terjadi kesalahan saat memproses permintaan.') {
  const responseData = error?.response?.data;
  const fieldErrors = responseData?.data?.errors;

  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstMsg = firstKey && Array.isArray(fieldErrors[firstKey]) ? fieldErrors[firstKey][0] : null;
    if (firstMsg) {
      return {
        message: firstMsg,
        errors: fieldErrors,
      };
    }
  }

  return {
    message: responseData?.message || fallbackMessage,
    errors: {},
  };
}

export default api;
