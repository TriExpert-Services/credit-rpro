-- CROA Compliance Tables Migration
-- Required for Credit Repair Organizations Act compliance

-- Table for tracking cancellation requests (CROA 3-day right to cancel)
CREATE TABLE IF NOT EXISTS cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    within_croa_period BOOLEAN DEFAULT true,
    cancellation_deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'denied', 'refunded')),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    refund_amount DECIMAL(10,2),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add cancellation columns to client_contracts if not exists
ALTER TABLE client_contracts 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Table for consumer rights acknowledgments (CROA requirement)
CREATE TABLE IF NOT EXISTS consumer_rights_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    UNIQUE(user_id, version)
);

-- Table for tracking fee disclosures (CROA prohibits advance fees)
CREATE TABLE IF NOT EXISTS fee_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    disclosed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_description TEXT NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    payment_schedule TEXT,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45)
);

-- Compliance audit log enhancements
CREATE TABLE IF NOT EXISTS compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    -- Event types: 'rights_disclosure', 'contract_signed', 'cancellation_request', 
    -- 'fee_disclosure', 'service_started', 'dispute_sent', 'result_received'
    compliance_law VARCHAR(50) NOT NULL, -- 'CROA', 'FCRA', 'GLBA', 'STATE'
    description TEXT,
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster compliance queries
CREATE INDEX IF NOT EXISTS idx_compliance_events_user ON compliance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_law ON compliance_events(compliance_law);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_user ON cancellation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_status ON cancellation_requests(status);

-- View for compliance reporting
CREATE OR REPLACE VIEW compliance_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.first_name,
    u.last_name,
    -- Rights disclosure
    (SELECT acknowledged_at FROM consumer_rights_acknowledgments WHERE user_id = u.id ORDER BY acknowledged_at DESC LIMIT 1) as rights_acknowledged_at,
    -- Contract status
    (SELECT COUNT(*) FROM client_contracts WHERE client_id = u.id AND is_valid = true) as active_contracts,
    -- Cancellation status
    (SELECT COUNT(*) FROM cancellation_requests WHERE user_id = u.id) as cancellation_requests,
    -- Fee disclosures
    (SELECT COUNT(*) FROM fee_disclosures WHERE user_id = u.id AND acknowledged = true) as fee_disclosures_acknowledged,
    -- Days since signup
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - u.created_at)) as days_since_signup,
    -- Within CROA cancellation period
    CASE 
        WHEN (SELECT MIN(signed_date) FROM client_contracts WHERE client_id = u.id) IS NULL THEN false
        WHEN CURRENT_TIMESTAMP <= (
            SELECT MIN(signed_date) + INTERVAL '3 days' 
            FROM client_contracts WHERE client_id = u.id
        ) THEN true
        ELSE false
    END as within_croa_cancellation_period
FROM users u
WHERE u.role = 'client';

COMMENT ON TABLE cancellation_requests IS 'Tracks cancellation requests per CROA 3-day right to cancel requirement';
COMMENT ON TABLE consumer_rights_acknowledgments IS 'Records when consumers acknowledged receiving their rights disclosure';
COMMENT ON TABLE compliance_events IS 'Comprehensive audit log for all compliance-related events';
