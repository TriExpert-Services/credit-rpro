/**
 * Credit Repair SaaS - Type Definitions
 * Interfaces y tipos centralizados para toda la aplicación
 */

// ============================================
// User & Authentication Types
// ============================================

export type UserRole = 'client' | 'admin' | 'staff';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// ============================================
// Client Profile Types
// ============================================

export type SubscriptionStatus = 'trial' | 'active' | 'paused' | 'cancelled';

export interface ClientProfile {
  id: string;
  userId: string;
  dateOfBirth?: string;
  ssnLast4?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  monthlyFee: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Client extends User {
  profile?: ClientProfile;
  totalItems?: number;
  totalDisputes?: number;
}

// ============================================
// Credit Score Types
// ============================================

export type CreditBureau = 'experian' | 'equifax' | 'transunion';
export type CreditBureauOrAll = CreditBureau | 'all';

export interface CreditScore {
  id: string;
  clientId: string;
  bureau: CreditBureau;
  score: number;
  scoreDate: string;
  notes?: string;
  createdAt: string;
}

export interface CreditScoreTrend {
  bureau: CreditBureau;
  scores: Array<{
    date: string;
    score: number;
  }>;
  change: number;
}

export interface AddCreditScoreData {
  clientId: string;
  bureau: CreditBureau;
  score: number;
  scoreDate: string;
  notes?: string;
}

// ============================================
// Credit Item Types
// ============================================

export type CreditItemType =
  | 'late_payment'
  | 'collection'
  | 'charge_off'
  | 'bankruptcy'
  | 'foreclosure'
  | 'repossession'
  | 'inquiry'
  | 'other';

export type CreditItemStatus = 'identified' | 'disputing' | 'deleted' | 'verified' | 'updated';

export interface CreditItem {
  id: string;
  clientId: string;
  itemType: CreditItemType;
  creditorName: string;
  accountNumber?: string;
  bureau: CreditBureauOrAll;
  balance?: number;
  status: CreditItemStatus;
  dateOpened?: string;
  dateReported?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AddCreditItemData {
  clientId: string;
  itemType: CreditItemType;
  creditorName: string;
  accountNumber?: string;
  bureau: CreditBureauOrAll;
  balance?: number;
  dateOpened?: string;
  dateReported?: string;
  description?: string;
}

// ============================================
// Dispute Types
// ============================================

export type DisputeType =
  | 'not_mine'
  | 'paid'
  | 'inaccurate_info'
  | 'outdated'
  | 'duplicate'
  | 'other';

export type DisputeStatus =
  | 'draft'
  | 'sent'
  | 'received'
  | 'investigating'
  | 'resolved'
  | 'rejected';

export interface Dispute {
  id: string;
  clientId: string;
  creditItemId?: string;
  disputeType: DisputeType;
  bureau: CreditBureau;
  letterContent: string;
  status: DisputeStatus;
  sentDate?: string;
  responseDate?: string;
  responseText?: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt?: string;
  // Joined fields
  creditItem?: CreditItem;
}

export interface CreateDisputeData {
  clientId: string;
  creditItemId?: string;
  disputeType: DisputeType;
  bureau: CreditBureau;
  customContent?: string;
}

export interface UpdateDisputeStatusData {
  status: DisputeStatus;
  responseText?: string;
  trackingNumber?: string;
}

// ============================================
// Document Types
// ============================================

export type DocumentCategory =
  | 'id'
  | 'proof_of_address'
  | 'credit_report'
  | 'dispute_letter'
  | 'response'
  | 'other';

export interface Document {
  id: string;
  clientId: string;
  disputeId?: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  documentCategory?: DocumentCategory;
  uploadedAt: string;
}

export interface UploadDocumentData {
  clientId: string;
  disputeId?: string;
  documentCategory: DocumentCategory;
  file: File;
}

// ============================================
// Payment Types
// ============================================

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  clientId: string;
  amount: number;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
  stripePaymentId?: string;
  description?: string;
  paymentDate: string;
}

export interface CreatePaymentData {
  clientId: string;
  amount: number;
  paymentMethod: string;
  description?: string;
}

// ============================================
// Dashboard Types
// ============================================

export interface ClientDashboardStats {
  creditScores: {
    experian?: number;
    equifax?: number;
    transunion?: number;
  };
  itemsByStatus: {
    identified: number;
    disputing: number;
    deleted: number;
    verified: number;
    updated: number;
  };
  activeDisputes: number;
  totalDisputes: number;
  recentActivity: ActivityLogItem[];
}

export interface AdminDashboardStats {
  totalClients: number;
  activeSubscriptions: number;
  totalDisputes: number;
  monthlyRevenue: number;
  recentClients: Client[];
  disputesByStatus: Record<DisputeStatus, number>;
}

// ============================================
// Activity Log Types
// ============================================

export interface ActivityLogItem {
  id: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  ipAddress?: string;
  createdAt: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiError {
  error: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// Form Validation Types
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: Record<keyof T, string | undefined>;
  isSubmitting: boolean;
  isValid: boolean;
}
