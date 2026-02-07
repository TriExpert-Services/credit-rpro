-- Plaid Integration Tables
-- Run this to add Plaid support to the database

-- Plaid Items (linked bank connections)
CREATE TABLE IF NOT EXISTS plaid_items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    institution_id VARCHAR(100),
    institution_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active', -- active, error, removed
    consent_expiration_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status);

-- Plaid Accounts (bank accounts from linked items)
CREATE TABLE IF NOT EXISTS plaid_accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(255) UNIQUE NOT NULL,
    item_id VARCHAR(255) REFERENCES plaid_items(item_id),
    name VARCHAR(255),
    official_name VARCHAR(255),
    type VARCHAR(50), -- depository, credit, loan, investment
    subtype VARCHAR(50), -- checking, savings, credit card, etc
    mask VARCHAR(10), -- Last 4 digits
    current_balance DECIMAL(12,2),
    available_balance DECIMAL(12,2),
    ach_account_number TEXT, -- Encrypted
    ach_routing_number VARCHAR(20),
    ach_wire_routing VARCHAR(20),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON plaid_accounts(item_id);

-- Plaid Identity Verifications
CREATE TABLE IF NOT EXISTS plaid_identity_verifications (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, failed
    verified_name VARCHAR(255),
    verified_email VARCHAR(255),
    verified_phone VARCHAR(50),
    verified_address JSONB,
    verified_at TIMESTAMP,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plaid_identity_user ON plaid_identity_verifications(user_id);

-- Plaid Income Analysis
CREATE TABLE IF NOT EXISTS plaid_income_analysis (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    period_days INTEGER,
    total_deposits DECIMAL(12,2),
    estimated_monthly_income DECIMAL(12,2),
    transaction_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plaid_income_user ON plaid_income_analysis(user_id);

-- Plaid Logs (for debugging and audit)
CREATE TABLE IF NOT EXISTS plaid_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    item_id VARCHAR(255),
    request_id VARCHAR(255),
    status VARCHAR(50),
    error_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plaid_logs_user ON plaid_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_logs_action ON plaid_logs(action);

-- Add identity_verified columns to client_profiles if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_profiles' AND column_name = 'identity_verified') THEN
        ALTER TABLE client_profiles ADD COLUMN identity_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_profiles' AND column_name = 'identity_verified_at') THEN
        ALTER TABLE client_profiles ADD COLUMN identity_verified_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_profiles' AND column_name = 'bank_account_linked') THEN
        ALTER TABLE client_profiles ADD COLUMN bank_account_linked BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON plaid_items TO creditrepair;
GRANT ALL ON plaid_accounts TO creditrepair;
GRANT ALL ON plaid_identity_verifications TO creditrepair;
GRANT ALL ON plaid_income_analysis TO creditrepair;
GRANT ALL ON plaid_logs TO creditrepair;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO creditrepair;
