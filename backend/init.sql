-- Credit Repair SaaS Database Schema
-- Created: 2026
-- Note: Database is created by POSTGRES_DB env var in docker-compose.yml

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (both clients and admin staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- Nullable for Auth0 users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin', 'staff')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    -- Auth0 fields
    auth0_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(20) DEFAULT 'local' CHECK (auth_provider IN ('local', 'auth0', 'google', 'github')),
    picture TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    -- Two-Factor Authentication (2FA) fields
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    two_factor_backup_codes TEXT[],
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Index for Auth0 lookups
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id) WHERE auth0_id IS NOT NULL;

-- Client profiles with additional information
CREATE TABLE client_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    ssn_last_4 VARCHAR(4),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'paused', 'cancelled')),
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    monthly_fee DECIMAL(10, 2) DEFAULT 99.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit scores tracking
CREATE TABLE credit_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    score INTEGER NOT NULL CHECK (score >= 300 AND score <= 850),
    score_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit report items (negative items to dispute)
CREATE TABLE credit_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('late_payment', 'collection', 'charge_off', 'bankruptcy', 'foreclosure', 'repossession', 'inquiry', 'other')),
    creditor_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100),
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion', 'all')),
    balance DECIMAL(10, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'in_dispute', 'disputing', 'resolved', 'deleted', 'verified', 'updated')),
    date_opened DATE,
    date_reported DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dispute letters
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    credit_item_id UUID REFERENCES credit_items(id) ON DELETE SET NULL,
    dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('not_mine', 'paid', 'inaccurate_info', 'outdated', 'duplicate', 'other')),
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    letter_content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'investigating', 'resolved', 'rejected')),
    sent_date DATE,
    response_date DATE,
    response_text TEXT,
    tracking_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents (uploaded files)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    document_category VARCHAR(50) CHECK (document_category IN ('id', 'proof_of_address', 'credit_report', 'dispute_letter', 'response', 'other')),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes (internal staff notes about clients)
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_id VARCHAR(255),
    description TEXT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    variables JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_client_profiles_user_id ON client_profiles(user_id);
CREATE INDEX idx_credit_scores_client_id ON credit_scores(client_id);
CREATE INDEX idx_credit_scores_date ON credit_scores(score_date DESC);
CREATE INDEX idx_credit_items_client_id ON credit_items(client_id);
CREATE INDEX idx_credit_items_status ON credit_items(status);
CREATE INDEX idx_disputes_client_id ON disputes(client_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_notes_client_id ON notes(client_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);

-- Create default admin user (password: Admin123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, status)
VALUES (
    'admin@creditrepair.com',
    '$2a$10$baLbyuy3GVGMPeZD56YMoOx7CiWboiwaUElpYd5ZHiTfsPXNbY4m.',
    'Admin',
    'User',
    'admin',
    'active'
);

-- ============================================================================
-- PHASE 2: ADVANCED FEATURES - Developer Settings, Contracts, Invoices, etc.
-- ============================================================================

-- Admin settings for API keys and configuration (encrypted)
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL, -- Should be encrypted in application layer
    setting_type VARCHAR(50) NOT NULL CHECK (setting_type IN ('api_key', 'config', 'webhook')),
    is_encrypted BOOLEAN DEFAULT true,
    description TEXT,
    last_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contract templates and signed contracts
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('service_agreement', 'privacy_policy', 'payment_terms', 'dispute_authorization')),
    template_version INTEGER NOT NULL DEFAULT 1,
    template_content TEXT NOT NULL, -- HTML content
    effective_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client signed contracts (with digital signature)
CREATE TABLE client_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE RESTRICT,
    contract_type VARCHAR(50) NOT NULL,
    signed_date TIMESTAMP NOT NULL,
    signature_data BYTEA, -- Digital signature
    signature_method VARCHAR(50) CHECK (signature_method IN ('digital', 'electronic', 'uploaded_scanned')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_valid BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client onboarding flow tracking
CREATE TABLE client_onboarding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    onboarding_type VARCHAR(50) NOT NULL CHECK (onboarding_type IN ('self_service', 'admin_guided')),
    step_current INTEGER DEFAULT 1,
    step_max INTEGER DEFAULT 5,
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused')),
    profile_completed BOOLEAN DEFAULT false,
    documents_uploaded BOOLEAN DEFAULT false,
    contracts_signed BOOLEAN DEFAULT false,
    payment_verified BOOLEAN DEFAULT false,
    onboarding_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    onboarding_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (Billing)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    billing_period_start DATE,
    billing_period_end DATE,
    due_date DATE,
    invoice_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    sent_date TIMESTAMP,
    paid_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications system (email, SMS, in-app)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('welcome', 'dispute_generated', 'dispute_sent', 'payment_reminder', 'contract_reminder', 'score_update', 'bureau_response', 'status_update', 'admin_alert')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'in_app', 'all')),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    delivery_status VARCHAR(30) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Process notes (detailed apuntes on each stage)
CREATE TABLE process_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    process_stage VARCHAR(50) NOT NULL CHECK (process_stage IN ('intake', 'profile', 'analysis', 'strategy', 'disputes', 'follow_up', 'resolution', 'other')),
    note_text TEXT NOT NULL,
    note_category VARCHAR(50) CHECK (note_category IN ('action_item', 'observation', 'decision', 'follow_up', 'result')),
    is_important BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(50), -- credit_item, dispute, payment, etc.
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for compliance (FCRA, GDPR)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) CHECK (action_type IN ('create', 'read', 'update', 'delete', 'sign', 'send', 'receive', 'export', 'delete_personal_data')),
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason VARCHAR(255),
    compliance_context VARCHAR(50) CHECK (compliance_context IN ('fcra', 'gdpr', 'ccpa', 'glba', 'other')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit score calculation audit (for transparency)
CREATE TABLE credit_score_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    bureau VARCHAR(20) NOT NULL,
    previous_score INTEGER,
    new_score INTEGER,
    score_change INTEGER,
    factors JSONB, -- Array of factors affecting score
    data_source VARCHAR(50), -- manual_entry, api_integration, import
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create comprehensive indexes
CREATE INDEX idx_admin_settings_key ON admin_settings(setting_key);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_active ON contracts(is_active);
CREATE INDEX idx_client_contracts_client_id ON client_contracts(client_id);
CREATE INDEX idx_client_contracts_signed_date ON client_contracts(signed_date DESC);
CREATE INDEX idx_onboarding_client_id ON client_onboarding(client_id);
CREATE INDEX idx_onboarding_status ON client_onboarding(status);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_process_notes_client_id ON process_notes(client_id);
CREATE INDEX idx_process_notes_stage ON process_notes(process_stage);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_compliance ON audit_log(compliance_context);
CREATE INDEX idx_credit_score_audit_client ON credit_score_audit(client_id);
CREATE INDEX idx_credit_score_audit_date ON credit_score_audit(created_at DESC);

-- Insert some example email templates
INSERT INTO email_templates (template_name, subject, body_html, body_text, variables)
VALUES 
(
    'welcome_email',
    'Bienvenido a {{company_name}}',
    '<h1>Bienvenido {{first_name}}!</h1><p>Estamos emocionados de ayudarte en tu viaje de reparación de crédito.</p>',
    'Bienvenido {{first_name}}! Estamos emocionados de ayudarte en tu viaje de reparación de crédito.',
    '["company_name", "first_name"]'::jsonb
),
(
    'dispute_sent',
    'Tu carta de disputa ha sido enviada',
    '<h1>Carta de Disputa Enviada</h1><p>Tu carta de disputa al bureau {{bureau}} ha sido enviada exitosamente.</p>',
    'Tu carta de disputa al bureau {{bureau}} ha sido enviada exitosamente.',
    '["bureau", "tracking_number"]'::jsonb
),
(
    'contract_signature_reminder',
    'Acción Requerida: Firma tu Contrato de Servicios',
    '<h1>Hola {{first_name}}</h1><p>Por favor firma tu contrato de servicios para completar tu registro.</p><a href="{{signature_link}}">Firmar Contrato</a>',
    'Hola {{first_name}}. Por favor firma tu contrato en: {{signature_link}}',
    '["first_name", "signature_link", "contract_type"]'::jsonb
),
(
    'payment_reminder',
    'Recordatorio de Pago - Factura {{invoice_number}} Vence en {{days_until_due}} días',
    '<h1>Recordatorio de Pago</h1><p>Tu factura {{invoice_number}} por {{amount}} vence el {{due_date}}.</p>',
    'Tu factura {{invoice_number}} por {{amount}} vence el {{due_date}}.',
    '["invoice_number", "amount", "due_date", "days_until_due"]'::jsonb
),
(
    'bureau_response',
    'Respuesta del Bureau: {{bureau}} - Referencia {{tracking_number}}',
    '<h1>Respuesta Recibida de {{bureau}}</h1><p>El bureau {{bureau}} ha respondido a tu disputa. Ver detalles:</p>',
    'El bureau {{bureau}} ha respondido a tu disputa {{tracking_number}}.',
    '["bureau", "tracking_number", "response_date"]'::jsonb
),
(
    'admin_alert',
    'Alerta de Sistema: {{alert_type}}',
    '<h1>Alerta de Sistema</h1><p>{{alert_message}}</p>',
    '{{alert_message}}',
    '["alert_type", "alert_message"]'::jsonb
);
