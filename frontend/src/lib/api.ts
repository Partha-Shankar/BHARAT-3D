import axios from 'axios';
import { getToken, removeToken, removeUser } from './auth';

const apiBaseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or invalid session sends the user back to sign in (login failures are handled by the form).
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    if (status === 401 && !url.includes('/auth/login') && window.location.pathname !== '/login') {
      removeToken();
      removeUser();
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
