import axios from 'axios';
import { queryClient } from '../queryClient';

// Use VITE_API_URL when set (production: direct Render URL, bypasses Netlify's 26s proxy timeout).
// Falls back to '/api' for local development where the Vite proxy handles it.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token, signal for login page to show message, then redirect with returnUrl
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      queryClient.clear();
      try {
        sessionStorage.setItem('showSessionExpired', '1');
      } catch {
        // ignore
      }
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?returnUrl=${returnUrl}`;
    }
    return Promise.reject(error);
  }
);

export default api;
