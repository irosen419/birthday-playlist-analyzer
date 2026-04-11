import axios from 'axios';
import { clearAuthToken, getAuthToken } from '../lib/auth';

export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    if (status === 401 && !requestUrl.endsWith('/api/me')) {
      clearAuthToken();
      window.location.href = '/';
      return new Promise(() => {});
    }

    const serverMessage = error.response?.data?.error;
    const message = serverMessage || error.message || 'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
