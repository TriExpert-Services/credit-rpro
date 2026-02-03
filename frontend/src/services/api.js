import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
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

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data)
};

// Dashboard services
export const dashboardService = {
  getClientStats: (clientId) => api.get(`/dashboard/client/${clientId}`),
  getAdminStats: () => api.get('/dashboard/admin/stats')
};

// Credit scores services
export const creditScoreService = {
  getScores: (clientId) => api.get(`/credit-scores/client/${clientId}`),
  addScore: (data) => api.post('/credit-scores', data),
  getTrends: (clientId) => api.get(`/credit-scores/client/${clientId}/trends`)
};

// Credit items services
export const creditItemService = {
  getItems: (clientId) => api.get(`/credit-items/client/${clientId}`),
  addItem: (data) => api.post('/credit-items', data),
  updateStatus: (id, status) => api.put(`/credit-items/${id}/status`, { status }),
  deleteItem: (id) => api.delete(`/credit-items/${id}`)
};

// Disputes services
export const disputeService = {
  getDisputes: (clientId) => api.get(`/disputes/client/${clientId}`),
  getDispute: (id) => api.get(`/disputes/${id}`),
  createDispute: (data) => api.post('/disputes', data),
  updateStatus: (id, data) => api.put(`/disputes/${id}/status`, data)
};

// Documents services
export const documentService = {
  getDocuments: (clientId) => api.get(`/documents/client/${clientId}`),
  uploadDocument: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteDocument: (id) => api.delete(`/documents/${id}`)
};

// Clients services
export const clientService = {
  getClients: () => api.get('/clients'),
  getClient: (id) => api.get(`/clients/${id}`)
};

// Payments services
export const paymentService = {
  getPayments: (clientId) => api.get(`/payments/client/${clientId}`),
  createPayment: (data) => api.post('/payments', data)
};

export default api;
