/**
 * Credit Repair SaaS - Validation Utilities
 * Validadores y constantes centralizadas para el backend
 *
 * @module utils/validators
 */

const { body, param, query } = require('express-validator');

// ============================================
// Constants - Enum Values
// ============================================

/**
 * Roles de usuario válidos
 * @type {string[]}
 */
const USER_ROLES = ['client', 'admin', 'staff'];

/**
 * Estados de usuario válidos
 * @type {string[]}
 */
const USER_STATUSES = ['active', 'inactive', 'suspended'];

/**
 * Estados de suscripción válidos
 * @type {string[]}
 */
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'paused', 'cancelled'];

/**
 * Bureaus de crédito válidos
 * @type {string[]}
 */
const CREDIT_BUREAUS = ['experian', 'equifax', 'transunion'];

/**
 * Bureaus de crédito incluyendo 'all'
 * @type {string[]}
 */
const CREDIT_BUREAUS_WITH_ALL = [...CREDIT_BUREAUS, 'all'];

/**
 * Tipos de items de crédito válidos
 * @type {string[]}
 */
const CREDIT_ITEM_TYPES = [
  'late_payment',
  'collection',
  'charge_off',
  'bankruptcy',
  'foreclosure',
  'repossession',
  'inquiry',
  'other',
];

/**
 * Estados de items de crédito válidos
 * @type {string[]}
 */
const CREDIT_ITEM_STATUSES = ['identified', 'disputing', 'deleted', 'verified', 'updated'];

/**
 * Tipos de disputa válidos
 * @type {string[]}
 */
const DISPUTE_TYPES = ['not_mine', 'paid', 'inaccurate_info', 'outdated', 'duplicate', 'other'];

/**
 * Estados de disputa válidos
 * @type {string[]}
 */
const DISPUTE_STATUSES = ['draft', 'sent', 'received', 'investigating', 'resolved', 'rejected'];

/**
 * Categorías de documentos válidas
 * @type {string[]}
 */
const DOCUMENT_CATEGORIES = ['id', 'proof_of_address', 'credit_report', 'dispute_letter', 'response', 'other'];

/**
 * Estados de pago válidos
 * @type {string[]}
 */
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

/**
 * Tipos de archivo permitidos
 * @type {string[]}
 */
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/**
 * Extensiones de archivo permitidas
 * @type {string[]}
 */
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];

/**
 * Tamaño máximo de archivo en bytes (10MB)
 * @type {number}
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Rango de puntaje de crédito
 * @type {{min: number, max: number}}
 */
const CREDIT_SCORE_RANGE = { min: 300, max: 850 };

// ============================================
// Validation Patterns
// ============================================

/**
 * Patrones de validación
 * @type {Object}
 */
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s\-\+\(\)]{10,20}$/,
  ssn4: /^\d{4}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  state: /^[A-Z]{2}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// ============================================
// Reusable Validators
// ============================================

/**
 * Validador de UUID
 * @param {string} field - Nombre del campo
 * @param {string} [location='param'] - Ubicación del campo (param, body, query)
 * @returns {import('express-validator').ValidationChain}
 */
const validateUUID = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) : location === 'query' ? query(field) : body(field);
  return validator
    .trim()
    .notEmpty()
    .withMessage(`${field} es requerido`)
    .matches(PATTERNS.uuid)
    .withMessage(`${field} debe ser un UUID válido`);
};

/**
 * Validador de email
 * @returns {import('express-validator').ValidationChain}
 */
const validateEmail = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email es requerido')
    .isEmail()
    .withMessage('Email no es válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email no puede exceder 255 caracteres');

/**
 * Validador de contraseña
 * @param {string} [field='password'] - Nombre del campo
 * @returns {import('express-validator').ValidationChain}
 */
const validatePassword = (field = 'password') =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage('Contraseña es requerida')
    .isLength({ min: 6, max: 128 })
    .withMessage('Contraseña debe tener entre 6 y 128 caracteres');

/**
 * Validador de nombre
 * @param {string} field - Nombre del campo
 * @param {string} label - Etiqueta para mensajes de error
 * @returns {import('express-validator').ValidationChain}
 */
const validateName = (field, label) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label} es requerido`)
    .isLength({ min: 1, max: 100 })
    .withMessage(`${label} debe tener entre 1 y 100 caracteres`)
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/)
    .withMessage(`${label} solo puede contener letras, espacios y guiones`);

/**
 * Validador de teléfono (opcional)
 * @returns {import('express-validator').ValidationChain}
 */
const validatePhone = () =>
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(PATTERNS.phone)
    .withMessage('Teléfono no es válido');

/**
 * Validador de código postal
 * @returns {import('express-validator').ValidationChain}
 */
const validateZipCode = () =>
  body('zipCode')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(PATTERNS.zipCode)
    .withMessage('Código postal no es válido (ej: 12345 o 12345-6789)');

/**
 * Validador de estado (US)
 * @returns {import('express-validator').ValidationChain}
 */
const validateState = () =>
  body('state')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .toUpperCase()
    .matches(PATTERNS.state)
    .withMessage('Estado debe ser un código de 2 letras (ej: CA, TX)');

/**
 * Validador de puntaje de crédito
 * @returns {import('express-validator').ValidationChain}
 */
const validateCreditScore = () =>
  body('score')
    .notEmpty()
    .withMessage('Puntaje es requerido')
    .isInt({ min: CREDIT_SCORE_RANGE.min, max: CREDIT_SCORE_RANGE.max })
    .withMessage(`Puntaje debe estar entre ${CREDIT_SCORE_RANGE.min} y ${CREDIT_SCORE_RANGE.max}`);

/**
 * Validador de bureau de crédito
 * @param {boolean} [allowAll=false] - Si se permite el valor 'all'
 * @returns {import('express-validator').ValidationChain}
 */
const validateBureau = (allowAll = false) => {
  const validValues = allowAll ? CREDIT_BUREAUS_WITH_ALL : CREDIT_BUREAUS;
  return body('bureau')
    .trim()
    .notEmpty()
    .withMessage('Bureau es requerido')
    .toLowerCase()
    .isIn(validValues)
    .withMessage(`Bureau debe ser uno de: ${validValues.join(', ')}`);
};

/**
 * Validador de tipo de item de crédito
 * @returns {import('express-validator').ValidationChain}
 */
const validateCreditItemType = () =>
  body('itemType')
    .trim()
    .notEmpty()
    .withMessage('Tipo de item es requerido')
    .toLowerCase()
    .isIn(CREDIT_ITEM_TYPES)
    .withMessage(`Tipo de item debe ser uno de: ${CREDIT_ITEM_TYPES.join(', ')}`);

/**
 * Validador de estado de item de crédito
 * @returns {import('express-validator').ValidationChain}
 */
const validateCreditItemStatus = () =>
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Estado es requerido')
    .toLowerCase()
    .isIn(CREDIT_ITEM_STATUSES)
    .withMessage(`Estado debe ser uno de: ${CREDIT_ITEM_STATUSES.join(', ')}`);

/**
 * Validador de tipo de disputa
 * @returns {import('express-validator').ValidationChain}
 */
const validateDisputeType = () =>
  body('disputeType')
    .trim()
    .notEmpty()
    .withMessage('Tipo de disputa es requerido')
    .toLowerCase()
    .isIn(DISPUTE_TYPES)
    .withMessage(`Tipo de disputa debe ser uno de: ${DISPUTE_TYPES.join(', ')}`);

/**
 * Validador de estado de disputa
 * @returns {import('express-validator').ValidationChain}
 */
const validateDisputeStatus = () =>
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Estado es requerido')
    .toLowerCase()
    .isIn(DISPUTE_STATUSES)
    .withMessage(`Estado debe ser uno de: ${DISPUTE_STATUSES.join(', ')}`);

/**
 * Validador de categoría de documento
 * @returns {import('express-validator').ValidationChain}
 */
const validateDocumentCategory = () =>
  body('documentCategory')
    .optional()
    .trim()
    .toLowerCase()
    .isIn(DOCUMENT_CATEGORIES)
    .withMessage(`Categoría debe ser una de: ${DOCUMENT_CATEGORIES.join(', ')}`);

/**
 * Validador de fecha
 * @param {string} field - Nombre del campo
 * @param {boolean} [required=false] - Si es requerido
 * @returns {import('express-validator').ValidationChain}
 */
const validateDate = (field, required = false) => {
  let validator = body(field);
  if (!required) {
    validator = validator.optional({ nullable: true, checkFalsy: true });
  } else {
    validator = validator.notEmpty().withMessage(`${field} es requerido`);
  }
  return validator.isISO8601().withMessage(`${field} debe ser una fecha válida (YYYY-MM-DD)`);
};

/**
 * Validador de monto monetario
 * @param {string} [field='amount'] - Nombre del campo
 * @returns {import('express-validator').ValidationChain}
 */
const validateAmount = (field = 'amount') =>
  body(field)
    .notEmpty()
    .withMessage('Monto es requerido')
    .isFloat({ min: 0.01 })
    .withMessage('Monto debe ser mayor a 0');

// ============================================
// Validation Rule Sets
// ============================================

/**
 * Reglas de validación para registro
 * @type {import('express-validator').ValidationChain[]}
 */
const registerValidation = [
  validateEmail(),
  validatePassword(),
  validateName('firstName', 'Nombre'),
  validateName('lastName', 'Apellido'),
  validatePhone(),
];

/**
 * Reglas de validación para login
 * @type {import('express-validator').ValidationChain[]}
 */
const loginValidation = [
  validateEmail(),
  body('password').notEmpty().withMessage('Contraseña es requerida'),
];

/**
 * Reglas de validación para cambio de contraseña
 * @type {import('express-validator').ValidationChain[]}
 */
const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Contraseña actual es requerida'),
  validatePassword('newPassword'),
];

/**
 * Reglas de validación para actualizar perfil
 * @type {import('express-validator').ValidationChain[]}
 */
const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
  validatePhone(),
  body('addressLine1').optional().trim().isLength({ max: 255 }),
  body('addressLine2').optional().trim().isLength({ max: 255 }),
  body('city').optional().trim().isLength({ max: 100 }),
  validateState(),
  validateZipCode(),
];

/**
 * Reglas de validación para agregar puntaje de crédito
 * @type {import('express-validator').ValidationChain[]}
 */
const addCreditScoreValidation = [
  validateUUID('clientId', 'body'),
  validateBureau(false),
  validateCreditScore(),
  validateDate('scoreDate', true),
  body('notes').optional().trim().isLength({ max: 1000 }),
];

/**
 * Reglas de validación para agregar item de crédito
 * @type {import('express-validator').ValidationChain[]}
 */
const addCreditItemValidation = [
  validateUUID('clientId', 'body'),
  validateCreditItemType(),
  body('creditorName')
    .trim()
    .notEmpty()
    .withMessage('Nombre del acreedor es requerido')
    .isLength({ max: 255 }),
  body('accountNumber').optional().trim().isLength({ max: 100 }),
  validateBureau(true),
  body('balance').optional().isFloat({ min: 0 }),
  validateDate('dateOpened', false),
  validateDate('dateReported', false),
  body('description').optional().trim().isLength({ max: 2000 }),
];

/**
 * Reglas de validación para crear disputa
 * @type {import('express-validator').ValidationChain[]}
 */
const createDisputeValidation = [
  validateUUID('clientId', 'body'),
  body('creditItemId').optional().matches(PATTERNS.uuid),
  validateDisputeType(),
  validateBureau(false),
  body('customContent').optional().trim().isLength({ max: 10000 }),
];

/**
 * Reglas de validación para actualizar estado de disputa
 * @type {import('express-validator').ValidationChain[]}
 */
const updateDisputeStatusValidation = [
  validateDisputeStatus(),
  body('responseText').optional().trim().isLength({ max: 5000 }),
  body('trackingNumber').optional().trim().isLength({ max: 100 }),
];

/**
 * Reglas de validación para crear pago
 * @type {import('express-validator').ValidationChain[]}
 */
const createPaymentValidation = [
  validateUUID('clientId', 'body'),
  validateAmount(),
  body('paymentMethod').trim().notEmpty().isLength({ max: 50 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

// ============================================
// Exports
// ============================================

module.exports = {
  // Constants
  USER_ROLES,
  USER_STATUSES,
  SUBSCRIPTION_STATUSES,
  CREDIT_BUREAUS,
  CREDIT_BUREAUS_WITH_ALL,
  CREDIT_ITEM_TYPES,
  CREDIT_ITEM_STATUSES,
  DISPUTE_TYPES,
  DISPUTE_STATUSES,
  DOCUMENT_CATEGORIES,
  PAYMENT_STATUSES,
  ALLOWED_FILE_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE,
  CREDIT_SCORE_RANGE,
  PATTERNS,

  // Individual validators
  validateUUID,
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  validateZipCode,
  validateState,
  validateCreditScore,
  validateBureau,
  validateCreditItemType,
  validateCreditItemStatus,
  validateDisputeType,
  validateDisputeStatus,
  validateDocumentCategory,
  validateDate,
  validateAmount,

  // Validation rule sets
  registerValidation,
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  addCreditScoreValidation,
  addCreditItemValidation,
  createDisputeValidation,
  updateDisputeStatusValidation,
  createPaymentValidation,
};
