/**
 * Credit Repair SaaS - Application Constants
 * Valores centralizados para toda la aplicación
 */

import type {
  UserRole,
  UserStatus,
  SubscriptionStatus,
  CreditBureau,
  CreditBureauOrAll,
  CreditItemType,
  CreditItemStatus,
  DisputeType,
  DisputeStatus,
  DocumentCategory,
  PaymentStatus,
} from '../types';

// ============================================
// User Constants
// ============================================

export const USER_ROLES: Record<UserRole, { label: string; description: string }> = {
  client: { label: 'Cliente', description: 'Usuario cliente del sistema' },
  admin: { label: 'Administrador', description: 'Acceso completo al sistema' },
  staff: { label: 'Staff', description: 'Personal de soporte' },
} as const;

export const USER_STATUSES: Record<UserStatus, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'green' },
  inactive: { label: 'Inactivo', color: 'gray' },
  suspended: { label: 'Suspendido', color: 'red' },
} as const;

// ============================================
// Subscription Constants
// ============================================

export const SUBSCRIPTION_STATUSES: Record<SubscriptionStatus, { label: string; color: string; description: string }> = {
  trial: { label: 'Prueba', color: 'blue', description: 'Periodo de prueba gratuito' },
  active: { label: 'Activa', color: 'green', description: 'Suscripción activa' },
  paused: { label: 'Pausada', color: 'yellow', description: 'Suscripción pausada temporalmente' },
  cancelled: { label: 'Cancelada', color: 'red', description: 'Suscripción cancelada' },
} as const;

export const DEFAULT_MONTHLY_FEE = 99.00;
export const TRIAL_PERIOD_DAYS = 14;

// ============================================
// Credit Bureau Constants
// ============================================

export const CREDIT_BUREAUS: Record<CreditBureau, { label: string; fullName: string; color: string }> = {
  experian: { label: 'Experian', fullName: 'Experian Information Solutions', color: 'blue' },
  equifax: { label: 'Equifax', fullName: 'Equifax Inc.', color: 'red' },
  transunion: { label: 'TransUnion', fullName: 'TransUnion LLC', color: 'green' },
} as const;

export const CREDIT_BUREAU_OPTIONS: Array<{ value: CreditBureauOrAll; label: string }> = [
  { value: 'experian', label: 'Experian' },
  { value: 'equifax', label: 'Equifax' },
  { value: 'transunion', label: 'TransUnion' },
  { value: 'all', label: 'Todos los Bureaus' },
];

export const CREDIT_SCORE_RANGE = {
  min: 300,
  max: 850,
  poor: { min: 300, max: 579, label: 'Pobre', color: 'red' },
  fair: { min: 580, max: 669, label: 'Regular', color: 'orange' },
  good: { min: 670, max: 739, label: 'Bueno', color: 'yellow' },
  veryGood: { min: 740, max: 799, label: 'Muy Bueno', color: 'lime' },
  excellent: { min: 800, max: 850, label: 'Excelente', color: 'green' },
} as const;

// ============================================
// Credit Item Constants
// ============================================

export const CREDIT_ITEM_TYPES: Record<CreditItemType, { label: string; description: string; severity: 'low' | 'medium' | 'high' }> = {
  late_payment: { label: 'Pago Tardío', description: 'Pago realizado después de la fecha de vencimiento', severity: 'low' },
  collection: { label: 'Colección', description: 'Deuda enviada a agencia de cobranza', severity: 'medium' },
  charge_off: { label: 'Cargo a Pérdida', description: 'Deuda declarada como incobrable', severity: 'high' },
  bankruptcy: { label: 'Bancarrota', description: 'Declaración de bancarrota', severity: 'high' },
  foreclosure: { label: 'Ejecución Hipotecaria', description: 'Pérdida de propiedad por impago', severity: 'high' },
  repossession: { label: 'Reposesión', description: 'Vehículo u otro bien recuperado', severity: 'high' },
  inquiry: { label: 'Consulta', description: 'Consulta de crédito (hard inquiry)', severity: 'low' },
  other: { label: 'Otro', description: 'Otro tipo de item negativo', severity: 'medium' },
} as const;

export const CREDIT_ITEM_STATUSES: Record<CreditItemStatus, { label: string; color: string; description: string }> = {
  identified: { label: 'Identificado', color: 'gray', description: 'Item identificado, pendiente de acción' },
  disputing: { label: 'En Disputa', color: 'yellow', description: 'Disputa en proceso' },
  deleted: { label: 'Eliminado', color: 'green', description: 'Item eliminado del reporte' },
  verified: { label: 'Verificado', color: 'red', description: 'Bureau verificó que el item es correcto' },
  updated: { label: 'Actualizado', color: 'blue', description: 'Item fue actualizado/corregido' },
} as const;

// ============================================
// Dispute Constants
// ============================================

export const DISPUTE_TYPES: Record<DisputeType, { label: string; description: string; letterTemplate: string }> = {
  not_mine: {
    label: 'No es mío',
    description: 'Esta cuenta no me pertenece',
    letterTemplate: 'I am writing to dispute the following item that appears on my credit report. This account does not belong to me.',
  },
  paid: {
    label: 'Pagado',
    description: 'Esta cuenta ya fue pagada',
    letterTemplate: 'I am writing to dispute the following item. This account has been paid in full and should be updated accordingly.',
  },
  inaccurate_info: {
    label: 'Información Inexacta',
    description: 'La información reportada es incorrecta',
    letterTemplate: 'I am writing to dispute the following item due to inaccurate information being reported.',
  },
  outdated: {
    label: 'Información Obsoleta',
    description: 'Esta información ya no debería aparecer',
    letterTemplate: 'I am writing to dispute the following item as it is outdated and should no longer appear on my credit report.',
  },
  duplicate: {
    label: 'Duplicado',
    description: 'Este item aparece duplicado',
    letterTemplate: 'I am writing to dispute the following item as it appears to be a duplicate entry on my credit report.',
  },
  other: {
    label: 'Otro',
    description: 'Otra razón para disputar',
    letterTemplate: 'I am writing to dispute the following item on my credit report.',
  },
} as const;

export const DISPUTE_STATUSES: Record<DisputeStatus, { label: string; color: string; description: string; canEdit: boolean }> = {
  draft: { label: 'Borrador', color: 'gray', description: 'Carta en borrador', canEdit: true },
  sent: { label: 'Enviada', color: 'blue', description: 'Carta enviada al bureau', canEdit: false },
  received: { label: 'Recibida', color: 'indigo', description: 'Bureau confirmó recepción', canEdit: false },
  investigating: { label: 'En Investigación', color: 'yellow', description: 'Bureau está investigando', canEdit: false },
  resolved: { label: 'Resuelta', color: 'green', description: 'Disputa resuelta a favor', canEdit: false },
  rejected: { label: 'Rechazada', color: 'red', description: 'Disputa rechazada', canEdit: false },
} as const;

export const DISPUTE_RESPONSE_DEADLINE_DAYS = 30;

// ============================================
// Document Constants
// ============================================

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, { label: string; description: string; required: boolean }> = {
  id: { label: 'Identificación', description: 'Documento de identidad (ID, pasaporte, licencia)', required: true },
  proof_of_address: { label: 'Comprobante de Domicilio', description: 'Factura de servicios, estado de cuenta', required: true },
  credit_report: { label: 'Reporte de Crédito', description: 'Reporte de crédito de los bureaus', required: false },
  dispute_letter: { label: 'Carta de Disputa', description: 'Carta de disputa firmada', required: false },
  response: { label: 'Respuesta', description: 'Respuesta del bureau', required: false },
  other: { label: 'Otro', description: 'Otros documentos de soporte', required: false },
} as const;

export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============================================
// Payment Constants
// ============================================

export const PAYMENT_STATUSES: Record<PaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'yellow' },
  completed: { label: 'Completado', color: 'green' },
  failed: { label: 'Fallido', color: 'red' },
  refunded: { label: 'Reembolsado', color: 'gray' },
} as const;

export const PAYMENT_METHODS = [
  { value: 'credit_card', label: 'Tarjeta de Crédito' },
  { value: 'debit_card', label: 'Tarjeta de Débito' },
  { value: 'bank_transfer', label: 'Transferencia Bancaria' },
  { value: 'cash', label: 'Efectivo' },
] as const;

// ============================================
// Validation Constants
// ============================================

export const VALIDATION = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Ingresa un correo electrónico válido',
  },
  password: {
    minLength: 6,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
    message: 'La contraseña debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número',
  },
  phone: {
    pattern: /^[\d\s\-\+\(\)]{10,20}$/,
    message: 'Ingresa un número de teléfono válido',
  },
  ssn4: {
    pattern: /^\d{4}$/,
    message: 'Ingresa los últimos 4 dígitos del SSN',
  },
  zipCode: {
    pattern: /^\d{5}(-\d{4})?$/,
    message: 'Ingresa un código postal válido (ej: 12345 o 12345-6789)',
  },
  state: {
    pattern: /^[A-Z]{2}$/,
    message: 'Ingresa el código del estado (2 letras)',
  },
} as const;

// ============================================
// UI Constants
// ============================================

export const ITEMS_PER_PAGE = 10;
export const MAX_ITEMS_PER_PAGE = 100;

export const DATE_FORMATS = {
  display: 'dd/MM/yyyy',
  displayWithTime: 'dd/MM/yyyy HH:mm',
  api: 'yyyy-MM-dd',
  apiWithTime: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'PR', label: 'Puerto Rico' },
] as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Obtiene la calificación del puntaje de crédito
 */
export function getCreditScoreRating(score: number): typeof CREDIT_SCORE_RANGE.poor | typeof CREDIT_SCORE_RANGE.fair | typeof CREDIT_SCORE_RANGE.good | typeof CREDIT_SCORE_RANGE.veryGood | typeof CREDIT_SCORE_RANGE.excellent {
  if (score >= CREDIT_SCORE_RANGE.excellent.min) return CREDIT_SCORE_RANGE.excellent;
  if (score >= CREDIT_SCORE_RANGE.veryGood.min) return CREDIT_SCORE_RANGE.veryGood;
  if (score >= CREDIT_SCORE_RANGE.good.min) return CREDIT_SCORE_RANGE.good;
  if (score >= CREDIT_SCORE_RANGE.fair.min) return CREDIT_SCORE_RANGE.fair;
  return CREDIT_SCORE_RANGE.poor;
}

/**
 * Valida si el tipo de archivo está permitido
 */
export function isAllowedFileType(file: File): boolean {
  return ALLOWED_FILE_TYPES.includes(file.type);
}

/**
 * Valida si el tamaño del archivo está dentro del límite
 */
export function isAllowedFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE_BYTES;
}

/**
 * Formatea el tamaño del archivo para mostrar
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
