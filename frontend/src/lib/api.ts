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

/** Start waking the API as soon as any page opens (free hosting sleeps when idle); fire-and-forget, once. */
let woken = false;
export function wakeApi() {
  if (woken || typeof fetch === 'undefined') return;
  woken = true;
  const url = import.meta.env.VITE_API_URL ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/health` : '/api/__wake';
  fetch(url, { cache: 'no-store' }).catch(() => undefined);
}

export default api;
