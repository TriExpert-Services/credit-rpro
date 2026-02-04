/**
 * Credit Repair SaaS - API Service
 * Cliente HTTP centralizado con interceptores y servicios tipados
 *
 * @module services/api
 */

import axios from 'axios';

/** @type {string} URL base de la API */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Instancia de Axios configurada para la API
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos timeout
});

/**
 * Interceptor de request - Añade token de autenticación
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/**
 * Interceptor de response - Maneja errores globalmente
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Error de autenticación - limpiar sesión y redirigir
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Solo redirigir si no estamos ya en login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Timeout
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    }

    // Error de red
    if (!error.response) {
      console.error('Network error - no response received');
    }

    return Promise.reject(error);
  }
);

// ============================================
// Auth Services
// ============================================

/**
 * Servicios de autenticación
 * @namespace authService
 */
export const authService = {
  /**
   * Registra un nuevo usuario cliente
   * @param {Object} data - Datos de registro
   * @param {string} data.email - Email del usuario
   * @param {string} data.password - Contraseña (mínimo 6 caracteres)
   * @param {string} data.firstName - Nombre
   * @param {string} data.lastName - Apellido
   * @param {string} [data.phone] - Teléfono (opcional)
   * @returns {Promise<import('axios').AxiosResponse<{message: string, token: string, user: Object}>>}
   */
  register: (data) => api.post('/auth/register', data),

  /**
   * Inicia sesión de usuario
   * @param {Object} data - Credenciales
   * @param {string} data.email - Email del usuario
   * @param {string} data.password - Contraseña
   * @returns {Promise<import('axios').AxiosResponse<{message: string, token: string, user: Object}>>}
   */
  login: (data) => api.post('/auth/login', data),

  /**
   * Obtiene el perfil del usuario autenticado
   * @returns {Promise<import('axios').AxiosResponse<{user: Object, profile: Object}>>}
   */
  getProfile: () => api.get('/users/profile'),

  /**
   * Actualiza el perfil del usuario autenticado
   * @param {Object} data - Datos a actualizar
   * @param {string} [data.firstName] - Nombre
   * @param {string} [data.lastName] - Apellido
   * @param {string} [data.phone] - Teléfono
   * @param {string} [data.addressLine1] - Dirección línea 1
   * @param {string} [data.addressLine2] - Dirección línea 2
   * @param {string} [data.city] - Ciudad
   * @param {string} [data.state] - Estado (2 letras)
   * @param {string} [data.zipCode] - Código postal
   * @returns {Promise<import('axios').AxiosResponse<{message: string, user: Object}>>}
   */
  updateProfile: (data) => api.put('/users/profile', data),

  /**
   * Cambia la contraseña del usuario
   * @param {Object} data - Datos de cambio de contraseña
   * @param {string} data.currentPassword - Contraseña actual
   * @param {string} data.newPassword - Nueva contraseña
   * @returns {Promise<import('axios').AxiosResponse<{message: string}>>}
   */
  changePassword: (data) => api.post('/auth/change-password', data),
};

// ============================================
// Dashboard Services
// ============================================

/**
 * Servicios del dashboard
 * @namespace dashboardService
 */
export const dashboardService = {
  /**
   * Obtiene estadísticas del dashboard de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{stats: Object}>>}
   */
  getClientStats: (clientId) => api.get(`/dashboard/client/${clientId}`),

  /**
   * Obtiene estadísticas del dashboard administrativo
   * @returns {Promise<import('axios').AxiosResponse<{stats: Object}>>}
   */
  getAdminStats: () => api.get('/dashboard/admin/stats'),
};

// ============================================
// Credit Score Services
// ============================================

/**
 * Servicios de puntajes de crédito
 * @namespace creditScoreService
 */
export const creditScoreService = {
  /**
   * Obtiene los puntajes de crédito de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{scores: Array}>>}
   */
  getScores: (clientId) => api.get(`/credit-scores/client/${clientId}`),

  /**
   * Añade un nuevo puntaje de crédito
   * @param {Object} data - Datos del puntaje
   * @param {string} data.clientId - UUID del cliente
   * @param {('experian'|'equifax'|'transunion')} data.bureau - Bureau de crédito
   * @param {number} data.score - Puntaje (300-850)
   * @param {string} data.scoreDate - Fecha del puntaje (YYYY-MM-DD)
   * @param {string} [data.notes] - Notas adicionales
   * @returns {Promise<import('axios').AxiosResponse<{message: string, score: Object}>>}
   */
  addScore: (data) => api.post('/credit-scores', data),

  /**
   * Obtiene las tendencias de puntaje de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{trends: Array}>>}
   */
  getTrends: (clientId) => api.get(`/credit-scores/client/${clientId}/trends`),
};

// ============================================
// Credit Item Services
// ============================================

/**
 * Servicios de items de crédito (items negativos)
 * @namespace creditItemService
 */
export const creditItemService = {
  /**
   * Obtiene los items de crédito de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{items: Array}>>}
   */
  getItems: (clientId) => api.get(`/credit-items/client/${clientId}`),

  /**
   * Añade un nuevo item de crédito
   * @param {Object} data - Datos del item
   * @param {string} data.clientId - UUID del cliente
   * @param {('late_payment'|'collection'|'charge_off'|'bankruptcy'|'foreclosure'|'repossession'|'inquiry'|'other')} data.itemType - Tipo de item
   * @param {string} data.creditorName - Nombre del acreedor
   * @param {string} [data.accountNumber] - Número de cuenta
   * @param {('experian'|'equifax'|'transunion'|'all')} data.bureau - Bureau donde aparece
   * @param {number} [data.balance] - Saldo
   * @param {string} [data.dateOpened] - Fecha de apertura
   * @param {string} [data.dateReported] - Fecha de reporte
   * @param {string} [data.description] - Descripción
   * @returns {Promise<import('axios').AxiosResponse<{message: string, item: Object}>>}
   */
  addItem: (data) => api.post('/credit-items', data),

  /**
   * Actualiza el estado de un item de crédito
   * @param {string} id - UUID del item
   * @param {('identified'|'disputing'|'deleted'|'verified'|'updated')} status - Nuevo estado
   * @returns {Promise<import('axios').AxiosResponse<{message: string, item: Object}>>}
   */
  updateStatus: (id, status) => api.put(`/credit-items/${id}/status`, { status }),

  /**
   * Elimina un item de crédito
   * @param {string} id - UUID del item
   * @returns {Promise<import('axios').AxiosResponse<{message: string}>>}
   */
  deleteItem: (id) => api.delete(`/credit-items/${id}`),
};

// ============================================
// Dispute Services
// ============================================

/**
 * Servicios de disputas
 * @namespace disputeService
 */
export const disputeService = {
  /**
   * Obtiene las disputas de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{disputes: Array}>>}
   */
  getDisputes: (clientId) => api.get(`/disputes/client/${clientId}`),

  /**
   * Obtiene el detalle de una disputa
   * @param {string} id - UUID de la disputa
   * @returns {Promise<import('axios').AxiosResponse<{dispute: Object}>>}
   */
  getDispute: (id) => api.get(`/disputes/${id}`),

  /**
   * Crea una nueva disputa
   * @param {Object} data - Datos de la disputa
   * @param {string} data.clientId - UUID del cliente
   * @param {string} [data.creditItemId] - UUID del item de crédito asociado
   * @param {('not_mine'|'paid'|'inaccurate_info'|'outdated'|'duplicate'|'other')} data.disputeType - Tipo de disputa
   * @param {('experian'|'equifax'|'transunion')} data.bureau - Bureau destinatario
   * @param {string} [data.customContent] - Contenido personalizado de la carta
   * @returns {Promise<import('axios').AxiosResponse<{message: string, dispute: Object}>>}
   */
  createDispute: (data) => api.post('/disputes', data),

  /**
   * Actualiza el estado de una disputa
   * @param {string} id - UUID de la disputa
   * @param {Object} data - Datos de actualización
   * @param {('draft'|'sent'|'received'|'investigating'|'resolved'|'rejected')} data.status - Nuevo estado
   * @param {string} [data.responseText] - Texto de respuesta del bureau
   * @param {string} [data.trackingNumber] - Número de seguimiento
   * @returns {Promise<import('axios').AxiosResponse<{message: string, dispute: Object}>>}
   */
  updateStatus: (id, data) => api.put(`/disputes/${id}/status`, data),
};

// ============================================
// Document Services
// ============================================

/**
 * Servicios de documentos
 * @namespace documentService
 */
export const documentService = {
  /**
   * Obtiene los documentos de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{documents: Array}>>}
   */
  getDocuments: (clientId) => api.get(`/documents/client/${clientId}`),

  /**
   * Sube un nuevo documento
   * @param {FormData} formData - FormData con el archivo y metadatos
   * @returns {Promise<import('axios').AxiosResponse<{message: string, document: Object}>>}
   */
  uploadDocument: (formData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /**
   * Descarga un documento
   * @param {string} id - UUID del documento
   * @returns {Promise<import('axios').AxiosResponse<Blob>>}
   */
  downloadDocument: (id) =>
    api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    }),

  /**
   * Elimina un documento
   * @param {string} id - UUID del documento
   * @returns {Promise<import('axios').AxiosResponse<{message: string}>>}
   */
  deleteDocument: (id) => api.delete(`/documents/${id}`),
};

// ============================================
// Client Services
// ============================================

/**
 * Servicios de clientes (solo admin/staff)
 * @namespace clientService
 */
export const clientService = {
  /**
   * Obtiene la lista de todos los clientes
   * @returns {Promise<import('axios').AxiosResponse<{clients: Array}>>}
   */
  getClients: () => api.get('/clients'),

  /**
   * Obtiene el detalle de un cliente
   * @param {string} id - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{client: Object}>>}
   */
  getClient: (id) => api.get(`/clients/${id}`),

  /**
   * Busca clientes por criterio
   * @param {Object} params - Parámetros de búsqueda
   * @param {string} [params.search] - Texto de búsqueda (nombre, email)
   * @param {string} [params.status] - Filtro por estado de suscripción
   * @returns {Promise<import('axios').AxiosResponse<{clients: Array}>>}
   */
  searchClients: (params) => api.get('/clients/search', { params }),
};

// ============================================
// Payment Services
// ============================================

/**
 * Servicios de pagos
 * @namespace paymentService
 */
export const paymentService = {
  /**
   * Obtiene el historial de pagos de un cliente
   * @param {string} clientId - UUID del cliente
   * @returns {Promise<import('axios').AxiosResponse<{payments: Array}>>}
   */
  getPayments: (clientId) => api.get(`/payments/client/${clientId}`),

  /**
   * Crea un nuevo pago
   * @param {Object} data - Datos del pago
   * @param {string} data.clientId - UUID del cliente
   * @param {number} data.amount - Monto del pago
   * @param {string} data.paymentMethod - Método de pago
   * @param {string} [data.description] - Descripción del pago
   * @returns {Promise<import('axios').AxiosResponse<{message: string, payment: Object}>>}
   */
  createPayment: (data) => api.post('/payments', data),

  /**
   * Obtiene el detalle de un pago
   * @param {string} id - UUID del pago
   * @returns {Promise<import('axios').AxiosResponse<{payment: Object}>>}
   */
  getPayment: (id) => api.get(`/payments/${id}`),
};

// ============================================
// User Services (Admin)
// ============================================

/**
 * Servicios de usuarios (admin)
 * @namespace userService
 */
export const userService = {
  /**
   * Obtiene la lista de usuarios
   * @returns {Promise<import('axios').AxiosResponse<{users: Array}>>}
   */
  getUsers: () => api.get('/users'),

  /**
   * Actualiza el estado de un usuario
   * @param {string} id - UUID del usuario
   * @param {('active'|'inactive'|'suspended')} status - Nuevo estado
   * @returns {Promise<import('axios').AxiosResponse<{message: string}>>}
   */
  updateUserStatus: (id, status) => api.put(`/users/${id}/status`, { status }),
};

// ============================================
// Utility Functions
// ============================================

/**
 * Extrae el mensaje de error de una respuesta de error de Axios
 * @param {Error} error - Error de Axios
 * @param {string} [defaultMessage='Ha ocurrido un error'] - Mensaje por defecto
 * @returns {string} Mensaje de error
 */
export const getErrorMessage = (error, defaultMessage = 'Ha ocurrido un error') => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.errors?.length > 0) {
    return error.response.data.errors.map((e) => e.msg || e.message).join(', ');
  }
  if (error.message) {
    return error.message;
  }
  return defaultMessage;
};

/**
 * Verifica si un error es de tipo 401 (no autorizado)
 * @param {Error} error - Error de Axios
 * @returns {boolean}
 */
export const isUnauthorizedError = (error) => {
  return error.response?.status === 401;
};

/**
 * Verifica si un error es de tipo 403 (prohibido)
 * @param {Error} error - Error de Axios
 * @returns {boolean}
 */
export const isForbiddenError = (error) => {
  return error.response?.status === 403;
};

/**
 * Verifica si un error es de tipo 404 (no encontrado)
 * @param {Error} error - Error de Axios
 * @returns {boolean}
 */
export const isNotFoundError = (error) => {
  return error.response?.status === 404;
};

/**
 * Verifica si un error es de validación (400)
 * @param {Error} error - Error de Axios
 * @returns {boolean}
 */
export const isValidationError = (error) => {
  return error.response?.status === 400;
};

export default api;
