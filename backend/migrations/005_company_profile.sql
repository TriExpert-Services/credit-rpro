-- ============================================================================
-- Migration 005: Company Profile
-- Stores company/business data that can be edited by admins
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL DEFAULT 'Credit Repair Pro',
    legal_name VARCHAR(255),
    tax_id VARCHAR(50),
    address_street VARCHAR(255),
    address_suite VARCHAR(100),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_zip VARCHAR(20),
    address_country VARCHAR(100) DEFAULT 'US',
    phone VARCHAR(30),
    fax VARCHAR(30),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    business_license VARCHAR(100),
    founded_date DATE,
    description TEXT,
    industry VARCHAR(100) DEFAULT 'Credit Repair Services',
    social_facebook VARCHAR(255),
    social_twitter VARCHAR(255),
    social_linkedin VARCHAR(255),
    social_instagram VARCHAR(255),
    social_youtube VARCHAR(255),
    business_hours VARCHAR(255) DEFAULT 'Mon-Fri 9:00 AM - 5:00 PM',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    support_email VARCHAR(255),
    support_phone VARCHAR(30),
    billing_email VARCHAR(255),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default company profile
INSERT INTO company_profile (company_name, industry) 
VALUES ('Credit Repair Pro', 'Credit Repair Services')
ON CONFLICT DO NOTHING;
