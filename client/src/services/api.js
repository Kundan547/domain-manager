import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
        case 403:
          toast.error('Access denied');
          break;
        case 404:
          toast.error('Resource not found');
          break;
        case 422:
          // Validation errors
          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach(err => {
              toast.error(err.msg || 'Validation error');
            });
          } else {
            toast.error(data.error || 'Validation error');
          }
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error(data.error || 'An error occurred');
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      // Other error
      toast.error('An unexpected error occurred');
    }
    
    return Promise.reject(error);
  }
);

// Domain API methods
export const domainAPI = {
  getAll: () => api.get('/domains'),
  getById: (id) => api.get(`/domains/${id}`),
  create: (data) => api.post('/domains', data),
  update: (id, data) => api.put(`/domains/${id}`, data),
  delete: (id) => api.delete(`/domains/${id}`),
  getStats: () => api.get('/domains/stats/overview'),
  getExpiringSoon: (days = 30) => api.get(`/domains/expiring-soon?days=${days}`),
};

// SSL API methods
export const sslAPI = {
  check: (domainId) => api.post(`/ssl/check/${domainId}`),
  getByDomain: (domainId) => api.get(`/ssl/${domainId}`),
  update: (domainId, data) => api.put(`/ssl/${domainId}`, data),
  delete: (domainId) => api.delete(`/ssl/${domainId}`),
  getExpiringSoon: (days = 30) => api.get(`/ssl/expiring-soon?days=${days}`),
  bulkCheck: () => api.post('/ssl/bulk-check'),
};

// Alert API methods
export const alertAPI = {
  getAll: () => api.get('/alerts'),
  getByDomain: (domainId) => api.get(`/alerts/domain/${domainId}`),
  create: (data) => api.post('/alerts', data),
  update: (id, data) => api.put(`/alerts/${id}`, data),
  delete: (id) => api.delete(`/alerts/${id}`),
  test: (id) => api.post(`/alerts/test/${id}`),
  getLogs: () => api.get('/alerts/logs'),
  bulkUpdate: (domainId, alerts) => api.put(`/alerts/domain/${domainId}/bulk`, { alerts }),
};

// Audit API methods
export const auditAPI = {
  getAll: (params = {}) => api.get('/audit', { params }),
  getByDomain: (domainId, params = {}) => api.get(`/audit/domain/${domainId}`, { params }),
  getStats: (params = {}) => api.get('/audit/stats', { params }),
  export: (params = {}) => api.get('/audit/export', { params }),
  getById: (id) => api.get(`/audit/${id}`),
};

// Auth API methods
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  signup: (userData) => api.post('/auth/signup', userData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export default api; 