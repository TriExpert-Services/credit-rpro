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

// ============================================
// Notification Types
// ============================================

export type NotificationType =
  | 'dispute_created'
  | 'dispute_sent'
  | 'dispute_response'
  | 'dispute_resolved'
  | 'dispute_rejected'
  | 'score_updated'
  | 'score_improved'
  | 'score_declined'
  | 'item_deleted'
  | 'item_verified'
  | 'item_updated'
  | 'welcome'
  | 'password_changed'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'payment_received'
  | 'payment_failed'
  | 'document_uploaded'
  | 'action_required'
  | 'reminder'
  | 'milestone';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  data?: Record<string, unknown>;
  readAt?: string;
  emailSent: boolean;
  emailSentAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// ============================================
// Timeline & Tracking Types
// ============================================

export type TimelineEventType =
  | 'account_created'
  | 'stage_changed'
  | 'milestone_reached'
  | 'document_uploaded'
  | 'document_verified'
  | 'document_rejected'
  | 'item_identified'
  | 'item_status_changed'
  | 'item_deleted'
  | 'dispute_created'
  | 'dispute_letter_generated'
  | 'dispute_sent'
  | 'dispute_response_received'
  | 'dispute_resolved'
  | 'dispute_rejected'
  | 'score_recorded'
  | 'score_improved'
  | 'score_declined'
  | 'payment_made'
  | 'subscription_started'
  | 'subscription_renewed'
  | 'note_added'
  | 'staff_action';

export interface TimelineEvent {
  id: string;
  clientId: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  performedBy?: string;
  performerFirstName?: string;
  performerLastName?: string;
  createdAt: string;
}

export interface ProcessStage {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  order: number;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ProcessProgress {
  percentage: number;
  points: number;
  maxPoints: number;
}

export interface ProcessStatistics {
  documents: Record<string, number>;
  items: Record<CreditItemStatus, number>;
  disputes: Record<DisputeStatus, number>;
  scores: Record<CreditBureau, { score: number; date: string }>;
  totalItemsIdentified: number;
  totalItemsDeleted: number;
  totalDisputesSent: number;
  activeDisputes: number;
}

export interface NextStep {
  priority: 'low' | 'medium' | 'high';
  action: string;
  description: string;
}

export interface ProcessStatus {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    subscriptionStatus: SubscriptionStatus;
    memberSince: string;
  };
  currentStage: ProcessStage;
  progress: ProcessProgress;
  statistics: ProcessStatistics;
  milestones: {
    achieved: string[];
    available: string[];
  };
  stages: ProcessStage[];
}

export interface ProcessSummary {
  currentStage: ProcessStage;
  progress: ProcessProgress;
  statistics: ProcessStatistics;
  recentActivity: TimelineEvent[];
  daysInProgram: number;
  nextSteps: NextStep[];
  milestonesAchieved: number;
  totalMilestones: number;
}

// ============================================
// AI Service Types
// ============================================

export interface BureauAddress {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  disputeUrl: string;
}

export interface GenerateLetterRequest {
  clientId: string;
  creditItemId?: string;
  disputeType: DisputeType;
  bureau: CreditBureau;
  additionalContext?: string;
  language?: 'en' | 'es';
  tone?: 'professional' | 'assertive' | 'formal';
}

export interface GeneratedLetter {
  letter: string;
  metadata: {
    generatedAt: string;
    provider: string;
    disputeType: DisputeType;
    bureau: CreditBureau;
    bureauAddress: BureauAddress;
  };
  bureauAddress: BureauAddress;
}

export interface CreateDisputeWithLetterResponse {
  dispute: Dispute & { aiGenerated: boolean };
  bureauAddress: BureauAddress;
}

export interface CreditReportAnalysis {
  items: Array<{
    creditorName: string;
    accountType: string;
    reportedBalance?: number;
    reason: string;
    recommendedDisputeType: DisputeType;
    priority: 'low' | 'medium' | 'high';
  }>;
  rawAnalysis: string;
}

export interface CreditRecommendations {
  priorityActions: string[];
  timeline: string;
  highSuccessItems?: string[];
  recommendations: string[];
  warnings: string[];
}
