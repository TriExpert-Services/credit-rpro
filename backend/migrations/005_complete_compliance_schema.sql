-- Migration 005: Complete Legal Compliance Schema
-- Ensures all tables have required columns for full CROA compliance

-- =====================================================
-- UPDATE CLIENT_CONTRACTS TABLE
-- Add missing columns for full compliance
-- =====================================================

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add digital_signature column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'digital_signature') THEN
        ALTER TABLE client_contracts ADD COLUMN digital_signature VARCHAR(255);
    END IF;

    -- Add ip_address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'ip_address') THEN
        ALTER TABLE client_contracts ADD COLUMN ip_address VARCHAR(50);
    END IF;

    -- Add user_agent column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'user_agent') THEN
        ALTER TABLE client_contracts ADD COLUMN user_agent TEXT;
    END IF;

    -- Add acknowledgments column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'acknowledgments') THEN
        ALTER TABLE client_contracts ADD COLUMN acknowledgments JSONB;
    END IF;

    -- Add effective_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'effective_date') THEN
        ALTER TABLE client_contracts ADD COLUMN effective_date TIMESTAMP;
    END IF;

    -- Add cancellation_deadline column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'cancellation_deadline') THEN
        ALTER TABLE client_contracts ADD COLUMN cancellation_deadline TIMESTAMP;
    END IF;
END $$;

-- =====================================================
-- UPDATE CONSUMER_RIGHTS_ACKNOWLEDGMENTS TABLE
-- Add contract_id reference and acknowledgment_data
-- =====================================================

DO $$ 
BEGIN
    -- Add contract_id column (UUID type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consumer_rights_acknowledgments' AND column_name = 'contract_id') THEN
        ALTER TABLE consumer_rights_acknowledgments ADD COLUMN contract_id UUID REFERENCES client_contracts(id);
    END IF;

    -- Add acknowledgment_data column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consumer_rights_acknowledgments' AND column_name = 'acknowledgment_data') THEN
        ALTER TABLE consumer_rights_acknowledgments ADD COLUMN acknowledgment_data JSONB;
    END IF;
END $$;

-- =====================================================
-- UPDATE FEE_DISCLOSURES TABLE
-- Add plan_type and payment_schedule columns
-- =====================================================

DO $$ 
BEGIN
    -- Add plan_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_disclosures' AND column_name = 'plan_type') THEN
        ALTER TABLE fee_disclosures ADD COLUMN plan_type VARCHAR(50);
    END IF;

    -- Add payment_schedule column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_disclosures' AND column_name = 'payment_schedule') THEN
        ALTER TABLE fee_disclosures ADD COLUMN payment_schedule VARCHAR(50) DEFAULT 'monthly';
    END IF;

    -- Add acknowledgment_data column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_disclosures' AND column_name = 'acknowledgment_data') THEN
        ALTER TABLE fee_disclosures ADD COLUMN acknowledgment_data JSONB;
    END IF;
END $$;

-- =====================================================
-- CREATE COMPLIANCE AUDIT LOG TABLE
-- Full audit trail for all compliance events
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- 'contract', 'rights', 'fees', 'cancellation'
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CREATE EMAIL LOG TABLE
-- Track all compliance-related emails
-- =====================================================

CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id),
    email_type VARCHAR(100) NOT NULL, -- 'contract_confirmation', 'cancellation', 'rights', 'fees'
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    message_id VARCHAR(255),
    error_message TEXT
);

-- =====================================================
-- INDEXES FOR COMPLIANCE TABLES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_events_client ON compliance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_created ON compliance_events(created_at);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_client ON compliance_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_action ON compliance_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_created ON compliance_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_email_log_client ON email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at);

CREATE INDEX IF NOT EXISTS idx_cancellation_requests_client ON cancellation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status ON cancellation_requests(status);

-- =====================================================
-- ADMIN COMPLIANCE REPORT VIEW
-- For generating compliance reports
-- =====================================================

CREATE OR REPLACE VIEW admin_compliance_report AS
SELECT 
    u.id AS user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.created_at AS account_created,
    cc.id AS contract_id,
    cc.signed_at AS contract_signed,
    cc.cancellation_deadline,
    cc.status AS contract_status,
    cc.cancelled_at,
    cra.acknowledged_at AS rights_acknowledged,
    fd.acknowledged_at AS fees_acknowledged,
    fd.total_cost AS disclosed_amount,
    (SELECT COUNT(*) FROM compliance_events WHERE user_id = u.id) AS total_compliance_events,
    (SELECT COUNT(*) FROM cancellation_requests WHERE user_id = u.id) AS cancellation_requests
FROM users u
LEFT JOIN client_contracts cc ON u.id = cc.client_id AND cc.id = (
    SELECT id FROM client_contracts WHERE client_id = u.id ORDER BY signed_at DESC LIMIT 1
)
LEFT JOIN consumer_rights_acknowledgments cra ON u.id = cra.user_id AND cra.id = (
    SELECT id FROM consumer_rights_acknowledgments WHERE user_id = u.id ORDER BY acknowledged_at DESC LIMIT 1
)
LEFT JOIN fee_disclosures fd ON u.id = fd.user_id AND fd.id = (
    SELECT id FROM fee_disclosures WHERE user_id = u.id ORDER BY acknowledged_at DESC LIMIT 1
)
WHERE u.role = 'client';

-- Done!
SELECT 'Migration 005 completed successfully - Full compliance schema updated' AS status;
