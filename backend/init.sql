-- Credit Repair SaaS Database Schema
-- Created: 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (both clients and admin staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin', 'staff')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

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
    status VARCHAR(30) NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'disputing', 'deleted', 'verified', 'updated')),
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
    '$2a$10$YQs8qy3W9pKk8h5Y1YJ5KeCbRjVNhNZzJQzZ3mYDHdPXnZKqJfKxW',
    'Admin',
    'User',
    'admin',
    'active'
);

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
);
