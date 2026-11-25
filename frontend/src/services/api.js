import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'wb_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'wb_refresh_token';
export const SESSION_EXPIRED_EVENT = 'wb:session-expired';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function setStoredAuthTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
}

export function clearStoredAuthTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

const api = axios.create({
  baseURL: API_BASE_URL,
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

// Single-flight mutex so concurrent 401 responses share one refresh request
let refreshInFlightPromise = null;

function isAuthEndpoint(url = '') {
  return /\/auth\/(login|register|refresh|logout)(\?|$)/.test(String(url));
}

function notifySessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

async function requestRefreshedAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) {
    throw new Error('Missing refresh token');
  }

  if (!refreshInFlightPromise) {
    refreshInFlightPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )
      .then((res) => {
        const data = res?.data?.data || {};
        const nextAccess = data.access_token || data.token;
        const nextRefresh = data.refresh_token;
        if (!nextAccess) {
          throw new Error('Invalid refresh response');
        }
        setStoredAuthTokens(nextAccess, nextRefresh);
        return nextAccess;
      })
      .finally(() => {
        refreshInFlightPromise = null;
      });
  }

  return refreshInFlightPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    const hadToken = Boolean(
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
        localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    );

    if (!localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)) {
      clearStoredAuthTokens();
      if (hadToken) {
        notifySessionExpired();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextAccessToken = await requestRefreshedAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredAuthTokens();
      if (hadToken) {
        notifySessionExpired();
      }
      return Promise.reject(refreshError);
    }
  }
);

/**
 * Extract readable error message and field errors from Laravel API responses.
 */
export function extractApiError(
  error,
  fallbackMessage = 'Terjadi kesalahan saat memproses permintaan.'
) {
  const responseData = error?.response?.data;
  const fieldErrors = responseData?.data?.errors;

  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstMsg =
      firstKey && Array.isArray(fieldErrors[firstKey]) ? fieldErrors[firstKey][0] : null;
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
