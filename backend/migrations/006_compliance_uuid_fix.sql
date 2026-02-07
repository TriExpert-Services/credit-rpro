-- Migration 006: Complete Compliance Schema Fix (UUID compatible)
-- Fix tables for full CROA compliance with UUID primary keys

-- =====================================================
-- ADD MISSING COLUMN TO CLIENT_CONTRACTS
-- =====================================================

DO $$ 
BEGIN
    -- Add signed_at column (alias for signed_date for API compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'signed_at') THEN
        ALTER TABLE client_contracts ADD COLUMN signed_at TIMESTAMP;
    END IF;

    -- Add status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_contracts' AND column_name = 'status') THEN
        ALTER TABLE client_contracts ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

-- Update signed_at from signed_date if null
UPDATE client_contracts SET signed_at = signed_date WHERE signed_at IS NULL;

-- =====================================================
-- UPDATE CONSUMER_RIGHTS_ACKNOWLEDGMENTS TABLE
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

    -- Add client_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'consumer_rights_acknowledgments' AND column_name = 'client_id') THEN
        ALTER TABLE consumer_rights_acknowledgments ADD COLUMN client_id UUID REFERENCES users(id);
    END IF;
END $$;

-- =====================================================
-- UPDATE FEE_DISCLOSURES TABLE
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

    -- Add client_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fee_disclosures' AND column_name = 'client_id') THEN
        ALTER TABLE fee_disclosures ADD COLUMN client_id UUID REFERENCES users(id);
    END IF;
END $$;

-- =====================================================
-- UPDATE COMPLIANCE_EVENTS TABLE
-- =====================================================

DO $$ 
BEGIN
    -- Add client_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'compliance_events' AND column_name = 'client_id') THEN
        ALTER TABLE compliance_events ADD COLUMN client_id UUID REFERENCES users(id);
    END IF;
END $$;

-- =====================================================
-- UPDATE CANCELLATION_REQUESTS TABLE
-- =====================================================

DO $$ 
BEGIN
    -- Add client_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cancellation_requests' AND column_name = 'client_id') THEN
        ALTER TABLE cancellation_requests ADD COLUMN client_id UUID REFERENCES users(id);
    END IF;

    -- Add contract_id column (UUID type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cancellation_requests' AND column_name = 'contract_id') THEN
        ALTER TABLE cancellation_requests ADD COLUMN contract_id UUID REFERENCES client_contracts(id);
    END IF;

    -- Add within_3_day_period column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cancellation_requests' AND column_name = 'within_3_day_period') THEN
        ALTER TABLE cancellation_requests ADD COLUMN within_3_day_period BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- CREATE COMPLIANCE AUDIT LOG TABLE (UUID compatible)
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CREATE EMAIL LOG TABLE (UUID compatible)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id),
    email_type VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'sent',
    message_id VARCHAR(255),
    error_message TEXT
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_audit_client ON compliance_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_action ON compliance_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_created ON compliance_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_email_log_client ON email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_log(sent_at);

-- Done!
SELECT 'Migration 006 completed successfully - UUID-compatible compliance schema' AS status;
