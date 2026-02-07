-- Migration: Stripe Subscription System with 90-day Guarantee
-- Run this after enhanced onboarding migration

-- ============================================================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL,
    price_yearly DECIMAL(10, 2),
    stripe_price_id_monthly VARCHAR(255),
    stripe_price_id_yearly VARCHAR(255),
    stripe_product_id VARCHAR(255),
    features JSONB, -- Array of features
    is_active BOOLEAN DEFAULT true,
    trial_days INTEGER DEFAULT 0,
    guarantee_days INTEGER DEFAULT 90, -- 90-day money back guarantee
    max_disputes_per_month INTEGER DEFAULT 10,
    includes_ai_analysis BOOLEAN DEFAULT true,
    includes_credit_monitoring BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLIENT SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_payment_method_id VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'trialing', 'active', 'past_due', 'canceled', 
        'unpaid', 'incomplete', 'incomplete_expired', 'paused',
        'refunded', 'guarantee_requested'
    )),
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    -- Guarantee tracking
    guarantee_start_date DATE,
    guarantee_end_date DATE,
    guarantee_claimed BOOLEAN DEFAULT false,
    guarantee_claim_date TIMESTAMP,
    guarantee_claim_reason TEXT,
    guarantee_approved BOOLEAN,
    guarantee_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    guarantee_refund_amount DECIMAL(10, 2),
    -- Service tracking
    service_start_date DATE,
    disputes_this_month INTEGER DEFAULT 0,
    total_disputes INTEGER DEFAULT 0,
    results_achieved JSONB, -- Track deletions, improvements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status ON client_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_stripe_customer ON client_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_stripe_sub ON client_subscriptions(stripe_subscription_id);

-- ============================================================================
-- PAYMENT TRANSACTIONS TABLE (Complete history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES client_subscriptions(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_refund_id VARCHAR(255),
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'subscription_payment', 'setup_fee', 'one_time', 
        'refund', 'guarantee_refund', 'chargeback', 'adjustment'
    )),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'pending', 'processing', 'succeeded', 'failed', 
        'canceled', 'refunded', 'disputed'
    )),
    payment_method_type VARCHAR(50), -- card, bank_transfer, etc.
    payment_method_last4 VARCHAR(4),
    payment_method_brand VARCHAR(50), -- visa, mastercard, etc.
    description TEXT,
    metadata JSONB,
    failure_code VARCHAR(100),
    failure_message TEXT,
    receipt_url TEXT,
    invoice_pdf_url TEXT,
    billing_period_start DATE,
    billing_period_end DATE,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_id ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_pi ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(created_at DESC);

-- ============================================================================
-- STRIPE WEBHOOKS LOG (For debugging and audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    api_version VARCHAR(20),
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processing_error TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_id ON stripe_webhook_logs(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_type ON stripe_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_processed ON stripe_webhook_logs(processed);

-- ============================================================================
-- PAYMENT METHODS TABLE (Client saved cards)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- card, bank_account, etc.
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_fingerprint VARCHAR(255),
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    is_default BOOLEAN DEFAULT false,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_payment_methods_client_id ON client_payment_methods(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_methods_stripe_pm ON client_payment_methods(stripe_payment_method_id);

-- ============================================================================
-- SERVICE AGREEMENT TABLE (Contract with guarantee terms)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES client_subscriptions(id) ON DELETE SET NULL,
    agreement_type VARCHAR(50) NOT NULL CHECK (agreement_type IN (
        'service_contract', 'payment_authorization', 'guarantee_terms', 'cancellation_policy'
    )),
    agreement_version VARCHAR(20) NOT NULL,
    agreement_content TEXT NOT NULL,
    signature_text VARCHAR(255),
    signature_hash VARCHAR(64),
    signed_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES service_agreements(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_agreements_client_id ON service_agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_type ON service_agreements(agreement_type);

-- ============================================================================
-- GUARANTEE CLAIMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS guarantee_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES client_subscriptions(id) ON DELETE SET NULL,
    claim_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claim_reason TEXT NOT NULL,
    service_start_date DATE NOT NULL,
    service_days INTEGER NOT NULL,
    total_paid DECIMAL(10, 2) NOT NULL,
    requested_refund_amount DECIMAL(10, 2) NOT NULL,
    -- Results documentation
    initial_credit_scores JSONB, -- {equifax: 580, experian: 590, transunion: 575}
    current_credit_scores JSONB,
    disputes_sent INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    -- Review process
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'under_review', 'approved', 'partial_approved', 
        'denied', 'refunded', 'withdrawn'
    )),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    approved_refund_amount DECIMAL(10, 2),
    denial_reason TEXT,
    -- Refund tracking
    refund_transaction_id UUID REFERENCES payment_transactions(id),
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guarantee_claims_client_id ON guarantee_claims(client_id);
CREATE INDEX IF NOT EXISTS idx_guarantee_claims_status ON guarantee_claims(status);

-- ============================================================================
-- REVENUE REPORTS TABLE (Monthly/Daily summaries)
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenue_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE NOT NULL,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    subscription_revenue DECIMAL(12, 2) DEFAULT 0,
    one_time_revenue DECIMAL(12, 2) DEFAULT 0,
    refunds DECIMAL(12, 2) DEFAULT 0,
    guarantee_refunds DECIMAL(12, 2) DEFAULT 0,
    chargebacks DECIMAL(12, 2) DEFAULT 0,
    net_revenue DECIMAL(12, 2) DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    canceled_subscriptions INTEGER DEFAULT 0,
    active_subscriptions INTEGER DEFAULT 0,
    trial_conversions INTEGER DEFAULT 0,
    guarantee_claims INTEGER DEFAULT 0,
    guarantee_approvals INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_revenue_reports_date ON revenue_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_reports_type ON revenue_reports(report_type);

-- ============================================================================
-- INSERT DEFAULT SUBSCRIPTION PLANS
-- ============================================================================

INSERT INTO subscription_plans (
    name, description, price_monthly, price_yearly, features, 
    is_active, guarantee_days, max_disputes_per_month, includes_ai_analysis, sort_order
) VALUES 
(
    'Plan Básico',
    'Ideal para comenzar tu viaje de reparación de crédito',
    99.00,
    990.00,
    '[
        "Análisis de reporte de crédito",
        "Hasta 5 cartas de disputa por mes",
        "Seguimiento de progreso",
        "Soporte por email",
        "Garantía de 90 días"
    ]'::jsonb,
    true,
    90,
    5,
    true,
    1
),
(
    'Plan Profesional',
    'Servicio completo con atención personalizada',
    149.00,
    1490.00,
    '[
        "Todo del Plan Básico",
        "Hasta 10 cartas de disputa por mes",
        "Análisis con IA avanzado",
        "Soporte prioritario por chat",
        "Revisión mensual con especialista",
        "Garantía de 90 días"
    ]'::jsonb,
    true,
    90,
    10,
    true,
    2
),
(
    'Plan Premium',
    'Máxima dedicación y resultados acelerados',
    249.00,
    2490.00,
    '[
        "Todo del Plan Profesional",
        "Disputas ilimitadas",
        "Agente dedicado",
        "Llamadas semanales de seguimiento",
        "Estrategia personalizada",
        "Monitoreo de crédito incluido",
        "Garantía extendida de 90 días"
    ]'::jsonb,
    true,
    90,
    999,
    true,
    3
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- UPDATE client_profiles to track subscription requirement
-- ============================================================================

ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS subscription_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS free_access_until TIMESTAMP;

-- ============================================================================
-- UPDATE users table for Stripe customer ID
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
