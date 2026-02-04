/**
 * Credit Repair SaaS - Response Helpers
 * Funciones para estandarizar respuestas de la API
 *
 * @module utils/responseHelpers
 */

/**
 * Códigos de estado HTTP comunes
 * @type {Object}
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * Envía una respuesta exitosa
 * @param {import('express').Response} res - Objeto response de Express
 * @param {Object} data - Datos a enviar
 * @param {string} [message] - Mensaje opcional
 * @param {number} [statusCode=200] - Código de estado HTTP
 */
const sendSuccess = (res, data, message = null, statusCode = HTTP_STATUS.OK) => {
  const response = { ...data };
  if (message) {
    response.message = message;
  }
  res.status(statusCode).json(response);
};

/**
 * Envía una respuesta de creación exitosa
 * @param {import('express').Response} res - Objeto response de Express
 * @param {Object} data - Datos a enviar
 * @param {string} [message='Created successfully'] - Mensaje
 */
const sendCreated = (res, data, message = 'Created successfully') => {
  sendSuccess(res, data, message, HTTP_STATUS.CREATED);
};

/**
 * Envía una respuesta de error
 * @param {import('express').Response} res - Objeto response de Express
 * @param {string} error - Mensaje de error
 * @param {number} [statusCode=400] - Código de estado HTTP
 * @param {Object} [details] - Detalles adicionales del error
 */
const sendError = (res, error, statusCode = HTTP_STATUS.BAD_REQUEST, details = null) => {
  const response = { error };
  if (details) {
    response.details = details;
  }
  res.status(statusCode).json(response);
};

/**
 * Envía un error de validación
 * @param {import('express').Response} res - Objeto response de Express
 * @param {Array} errors - Array de errores de validación
 */
const sendValidationError = (res, errors) => {
  res.status(HTTP_STATUS.BAD_REQUEST).json({
    error: 'Validation failed',
    errors: errors,
  });
};

/**
 * Envía un error de autenticación
 * @param {import('express').Response} res - Objeto response de Express
 * @param {string} [message='Unauthorized'] - Mensaje de error
 */
const sendUnauthorized = (res, message = 'Unauthorized') => {
  sendError(res, message, HTTP_STATUS.UNAUTHORIZED);
};

/**
 * Envía un error de permisos
 * @param {import('express').Response} res - Objeto response de Express
 * @param {string} [message='Access denied'] - Mensaje de error
 */
const sendForbidden = (res, message = 'Access denied') => {
  sendError(res, message, HTTP_STATUS.FORBIDDEN);
};

/**
 * Envía un error de recurso no encontrado
 * @param {import('express').Response} res - Objeto response de Express
 * @param {string} [resource='Resource'] - Nombre del recurso
 */
const sendNotFound = (res, resource = 'Resource') => {
  sendError(res, `${resource} not found`, HTTP_STATUS.NOT_FOUND);
};

/**
 * Envía un error de conflicto (recurso ya existe)
 * @param {import('express').Response} res - Objeto response de Express
 * @param {string} [message='Resource already exists'] - Mensaje de error
 */
const sendConflict = (res, message = 'Resource already exists') => {
  sendError(res, message, HTTP_STATUS.CONFLICT);
};

/**
 * Envía un error interno del servidor
 * @param {import('express').Response} res - Objeto response de Express
 * @param {Error} [error] - Error original (solo se loguea, no se envía)
 * @param {string} [message='Internal server error'] - Mensaje de error
 */
const sendInternalError = (res, error = null, message = 'Internal server error') => {
  if (error) {
    console.error('Internal server error:', error);
  }
  sendError(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
};

/**
 * Middleware para manejar errores de validación de express-validator
 * @param {import('express-validator').Result} validationResult - Resultado de validación
 * @param {import('express').Response} res - Objeto response de Express
 * @returns {boolean} - True si hay errores, false si no
 */
const handleValidationErrors = (validationResult, res) => {
  if (!validationResult.isEmpty()) {
    sendValidationError(res, validationResult.array());
    return true;
  }
  return false;
};

/**
 * Wrapper para manejar errores async en controladores
 * @param {Function} fn - Función async del controlador
 * @returns {Function} - Función wrapped con manejo de errores
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Async handler error:', error);
      sendInternalError(res, error);
    });
  };
};

/**
 * Formatea un objeto de base de datos de snake_case a camelCase
 * @param {Object} obj - Objeto con claves en snake_case
 * @returns {Object} - Objeto con claves en camelCase
 */
const toCamelCase = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
};

/**
 * Formatea un objeto de camelCase a snake_case
 * @param {Object} obj - Objeto con claves en camelCase
 * @returns {Object} - Objeto con claves en snake_case
 */
const toSnakeCase = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
};

/**
 * Sanitiza un objeto para respuesta (elimina campos sensibles)
 * @param {Object} obj - Objeto a sanitizar
 * @param {string[]} [fieldsToRemove] - Campos a eliminar
 * @returns {Object} - Objeto sanitizado
 */
const sanitizeResponse = (obj, fieldsToRemove = ['password_hash', 'passwordHash']) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeResponse(item, fieldsToRemove));

  const sanitized = { ...obj };
  fieldsToRemove.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
};

module.exports = {
  HTTP_STATUS,
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendInternalError,
  handleValidationErrors,
  asyncHandler,
  toCamelCase,
  toSnakeCase,
  sanitizeResponse,
};
