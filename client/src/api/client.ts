import axios from 'axios';

export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';

    if (status === 401 && !requestUrl.endsWith('/api/me')) {
      window.location.href = '/';
      return new Promise(() => {});
    }

    const serverMessage = error.response?.data?.error;
    const message = serverMessage || error.message || 'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
