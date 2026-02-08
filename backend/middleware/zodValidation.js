/**
 * Zod Validation Middleware & Schemas
 * Provides strict schema validation for all endpoints
 *
 * @module middleware/zodValidation
 */
const { z } = require('zod');

// ============================================
// Helper: Zod → Express middleware
// ============================================

/**
 * Creates an Express middleware that validates request data against a Zod schema
 * @param {Object} schemas - Object with optional body, query, params Zod schemas
 * @param {z.ZodType} [schemas.body] - Schema for req.body
 * @param {z.ZodType} [schemas.query] - Schema for req.query
 * @param {z.ZodType} [schemas.params] - Schema for req.params
 * @returns {import('express').RequestHandler}
 */
function validate(schemas) {
  return (req, res, next) => {
    const errors = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, location: 'params' })));
      } else {
        req.params = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, location: 'query' })));
      } else {
        req.query = result.data;
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message, location: 'body' })));
      } else {
        req.body = result.data;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        errors,
      });
    }

    next();
  };
}

// ============================================
// Reusable Zod primitives
// ============================================

const zuuid = z.string().uuid('Debe ser un UUID válido');
const zemail = z.string().email('Email no es válido').max(255).toLowerCase().trim();
const zpassword = z.string().min(6, 'Mínimo 6 caracteres').max(128, 'Máximo 128 caracteres');
const zname = z.string().trim().min(1, 'Requerido').max(100, 'Máximo 100 caracteres');
const zphone = z.string().trim().regex(/^[\d\s\-+()]{10,20}$/, 'Teléfono no válido').optional().nullable();
const zstate = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Debe ser código de 2 letras').optional().nullable();
const zzipCode = z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Código postal no válido').optional().nullable();

const CREDIT_BUREAUS = ['experian', 'equifax', 'transunion'];
const CREDIT_BUREAUS_ALL = [...CREDIT_BUREAUS, 'all'];
const CREDIT_ITEM_TYPES = ['late_payment', 'collection', 'charge_off', 'bankruptcy', 'foreclosure', 'repossession', 'inquiry', 'other'];
const CREDIT_ITEM_STATUSES = ['identified', 'disputing', 'deleted', 'verified', 'updated'];
const DISPUTE_TYPES = ['not_mine', 'paid', 'inaccurate_info', 'outdated', 'duplicate', 'other'];
const DISPUTE_STATUSES = ['draft', 'sent', 'received', 'investigating', 'resolved', 'rejected'];
const DOCUMENT_CATEGORIES = ['id', 'proof_of_address', 'credit_report', 'dispute_letter', 'response', 'other'];
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

// ============================================
// Param schemas (reusable)
// ============================================

const idParam = z.object({ id: zuuid });
const clientIdParam = z.object({ clientId: zuuid });

// ============================================
// Pagination query schema
// ============================================

const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).passthrough(); // allow additional query params

// ============================================
// Auth schemas
// ============================================

const registerSchema = z.object({
  email: zemail,
  password: zpassword,
  firstName: zname,
  lastName: zname,
  phone: zphone,
});

const loginSchema = z.object({
  email: zemail,
  password: z.string().min(1, 'Contraseña es requerida'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual es requerida'),
  newPassword: zpassword,
});

// ============================================
// Profile schemas
// ============================================

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: zphone,
  dateOfBirth: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  addressLine1: z.string().trim().max(255).optional().nullable(),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: zstate,
  zipCode: zzipCode,
});

// ============================================
// Credit Score schemas
// ============================================

const addCreditScoreSchema = z.object({
  clientId: zuuid,
  bureau: z.enum(CREDIT_BUREAUS, { errorMap: () => ({ message: `Bureau debe ser uno de: ${CREDIT_BUREAUS.join(', ')}` }) }),
  score: z.coerce.number().int().min(300, 'Mínimo 300').max(850, 'Máximo 850'),
  scoreDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

// ============================================
// Credit Item schemas
// ============================================

const addCreditItemSchema = z.object({
  clientId: zuuid,
  itemType: z.enum(CREDIT_ITEM_TYPES, { errorMap: () => ({ message: `Tipo inválido` }) }),
  creditorName: z.string().trim().min(1, 'Nombre del acreedor requerido').max(255),
  accountNumber: z.string().trim().max(100).optional().nullable(),
  bureau: z.enum(CREDIT_BUREAUS_ALL, { errorMap: () => ({ message: 'Bureau inválido' }) }),
  balance: z.coerce.number().min(0).optional().nullable(),
  dateOpened: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dateReported: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(CREDIT_ITEM_STATUSES).optional(),
});

const updateCreditItemSchema = z.object({
  status: z.enum(CREDIT_ITEM_STATUSES).optional(),
  creditorName: z.string().trim().max(255).optional(),
  accountNumber: z.string().trim().max(100).optional().nullable(),
  bureau: z.enum(CREDIT_BUREAUS_ALL).optional(),
  balance: z.coerce.number().min(0).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
}).passthrough();

// ============================================
// Dispute schemas
// ============================================

const createDisputeSchema = z.object({
  clientId: zuuid,
  creditItemId: zuuid.optional().nullable(),
  disputeType: z.enum(DISPUTE_TYPES, { errorMap: () => ({ message: 'Tipo de disputa inválido' }) }),
  bureau: z.enum(CREDIT_BUREAUS, { errorMap: () => ({ message: 'Bureau inválido' }) }),
  customContent: z.string().trim().max(10000).optional().nullable(),
});

const updateDisputeStatusSchema = z.object({
  status: z.enum(DISPUTE_STATUSES, { errorMap: () => ({ message: 'Estado inválido' }) }),
  responseText: z.string().trim().max(5000).optional().nullable(),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
});

// ============================================
// Payment schemas
// ============================================

const createPaymentSchema = z.object({
  clientId: zuuid,
  amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
  paymentMethod: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional().nullable(),
});

// ============================================
// AI Dispute schemas
// ============================================

const generateAIDisputeSchema = z.object({
  creditItemId: zuuid,
  disputeType: z.enum(DISPUTE_TYPES),
  bureau: z.enum(CREDIT_BUREAUS),
  additionalDetails: z.string().trim().max(5000).optional().nullable(),
});

const saveAIDisputeSchema = z.object({
  creditItemId: zuuid,
  bureau: z.enum(CREDIT_BUREAUS),
  disputeType: z.enum(DISPUTE_TYPES),
  content: z.string().trim().min(1).max(50000),
  strategy: z.string().trim().max(5000).optional().nullable(),
});

// ============================================
// Onboarding schemas
// ============================================

const saveProgressSchema = z.object({
  step: z.coerce.number().int().min(1).max(7, 'Step debe ser entre 1 y 7'),
  data: z.record(z.unknown()).optional(),
});

// ============================================
// Document schemas
// ============================================

const documentUploadSchema = z.object({
  clientId: zuuid.optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

// ============================================
// Subscription schemas
// ============================================

const checkoutSchema = z.object({
  planId: z.string().trim().min(1, 'Plan requerido'),
  paymentMethodId: z.string().trim().optional(),
});

// ============================================
// Admin Settings schemas
// ============================================

const adminSettingsSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.unknown(),
}).passthrough();

// ============================================
// Notes schemas
// ============================================

const createNoteSchema = z.object({
  clientId: zuuid,
  content: z.string().trim().min(1, 'Contenido es requerido').max(10000),
  noteType: z.string().trim().max(50).optional(),
});

// ============================================
// Notification schemas
// ============================================

const sendNotificationSchema = z.object({
  userId: zuuid,
  title: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(5000),
  type: z.string().trim().max(50).optional(),
});

// ============================================
// Exports
// ============================================

module.exports = {
  validate,
  // Primitives
  zuuid,
  zemail,
  zpassword,
  zname,
  // Param schemas
  idParam,
  clientIdParam,
  // Query schemas
  paginationQuery,
  // Auth
  registerSchema,
  loginSchema,
  changePasswordSchema,
  // Profile
  updateProfileSchema,
  // Credit scores
  addCreditScoreSchema,
  // Credit items
  addCreditItemSchema,
  updateCreditItemSchema,
  // Disputes
  createDisputeSchema,
  updateDisputeStatusSchema,
  // Payments
  createPaymentSchema,
  // AI Disputes
  generateAIDisputeSchema,
  saveAIDisputeSchema,
  // Onboarding
  saveProgressSchema,
  // Documents
  documentUploadSchema,
  // Subscriptions
  checkoutSchema,
  // Admin
  adminSettingsSchema,
  // Notes
  createNoteSchema,
  // Notifications
  sendNotificationSchema,
};
