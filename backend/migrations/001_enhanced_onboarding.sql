-- Migration: Enhanced Client Profiles for Legal Compliance
-- Run this after initial database setup

-- ============================================================================
-- ENHANCED CLIENT PROFILES TABLE
-- For Credit Repair Legal Compliance (CROA, FCRA)
-- ============================================================================

-- First, add new columns to client_profiles
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS suffix VARCHAR(10),
ADD COLUMN IF NOT EXISTS ssn_encrypted TEXT, -- Full SSN encrypted with AES-256
ADD COLUMN IF NOT EXISTS ssn_hash VARCHAR(64), -- SHA-256 hash for verification
ADD COLUMN IF NOT EXISTS phone_primary VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_alternate VARCHAR(20),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS residence_type VARCHAR(20) CHECK (residence_type IN ('rent', 'own', 'family', 'other')),
ADD COLUMN IF NOT EXISTS monthly_payment DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS move_in_date DATE;

-- Employment information
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30) CHECK (employment_status IN ('employed', 'self-employed', 'unemployed', 'retired', 'student')),
ADD COLUMN IF NOT EXISTS employer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS employer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS employer_address TEXT,
ADD COLUMN IF NOT EXISTS employment_start_date DATE,
ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12, 2);

-- Onboarding completion tracking
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS profile_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS profile_verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- CLIENT ADDRESSES TABLE (for address history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('current', 'previous', 'mailing')),
    street1 VARCHAR(255) NOT NULL,
    street2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'USA',
    from_date DATE,
    to_date DATE,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_type ON client_addresses(address_type);

-- ============================================================================
-- CLIENT AUTHORIZATIONS TABLE (Legal consents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    authorization_type VARCHAR(50) NOT NULL CHECK (authorization_type IN (
        'fcra_consent',           -- Fair Credit Reporting Act consent
        'credit_pull_consent',    -- Authorization to pull credit reports
        'communication_consent',  -- Email/SMS/Phone consent
        'electronic_signature',   -- E-SIGN Act consent
        'terms_of_service',       -- Service agreement
        'privacy_policy',         -- Privacy policy
        'limited_poa',            -- Limited Power of Attorney
        'dispute_authorization',  -- Authorization to dispute
        'payment_authorization',  -- Recurring payment auth
        'cancellation_policy'     -- Cancellation terms
    )),
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,
    consent_ip_address VARCHAR(45),
    consent_user_agent TEXT,
    document_version VARCHAR(20),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, authorization_type)
);

CREATE INDEX IF NOT EXISTS idx_client_authorizations_client_id ON client_authorizations(client_id);
CREATE INDEX IF NOT EXISTS idx_client_authorizations_type ON client_authorizations(authorization_type);

-- ============================================================================
-- CLIENT SIGNATURES TABLE (Electronic signatures)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN (
        'onboarding',
        'service_agreement',
        'dispute_letter',
        'poa_document',
        'cancellation_request',
        'payment_authorization'
    )),
    signature_text VARCHAR(255) NOT NULL, -- Typed signature
    signature_image TEXT, -- Base64 encoded signature image if drawn
    signature_hash VARCHAR(64), -- SHA-256 hash of signature + timestamp + IP
    signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB, -- {lat, lng, accuracy}
    related_document_id UUID,
    related_document_type VARCHAR(50),
    is_valid BOOLEAN DEFAULT true,
    invalidated_at TIMESTAMP,
    invalidation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_signatures_client_id ON client_signatures(client_id);
CREATE INDEX IF NOT EXISTS idx_client_signatures_type ON client_signatures(signature_type);

-- ============================================================================
-- ONBOARDING PROGRESS TABLE (Track step-by-step completion)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 7,
    
    -- Step completion tracking
    step_1_personal_info BOOLEAN DEFAULT false,
    step_1_completed_at TIMESTAMP,
    
    step_2_current_address BOOLEAN DEFAULT false,
    step_2_completed_at TIMESTAMP,
    
    step_3_address_history BOOLEAN DEFAULT false,
    step_3_completed_at TIMESTAMP,
    
    step_4_employment BOOLEAN DEFAULT false,
    step_4_completed_at TIMESTAMP,
    
    step_5_documents BOOLEAN DEFAULT false,
    step_5_completed_at TIMESTAMP,
    
    step_6_authorizations BOOLEAN DEFAULT false,
    step_6_completed_at TIMESTAMP,
    
    step_7_signature BOOLEAN DEFAULT false,
    step_7_completed_at TIMESTAMP,
    
    -- Overall progress
    form_data JSONB, -- Stores form progress between sessions
    status VARCHAR(30) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_client_id ON onboarding_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON onboarding_progress(status);

-- ============================================================================
-- CLIENT DOCUMENTS (Enhanced for compliance)
-- ============================================================================

-- Update documents table with more categories
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_document_category_check;

ALTER TABLE documents
ADD CONSTRAINT documents_document_category_check 
CHECK (document_category IN (
    'id',                    -- Government ID
    'drivers_license',       -- Driver's License
    'passport',              -- Passport
    'state_id',              -- State ID
    'military_id',           -- Military ID
    'ssn_card',              -- Social Security Card
    'proof_of_address',      -- Utility bills, etc.
    'credit_report',         -- Credit reports
    'dispute_letter',        -- Dispute letters
    'response',              -- Bureau responses
    'contract',              -- Signed contracts
    'poa',                   -- Power of Attorney
    'authorization',         -- Authorization forms
    'other'
));

-- Add verification fields to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS expires_at DATE,
ADD COLUMN IF NOT EXISTS document_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(255),
ADD COLUMN IF NOT EXISTS issue_date DATE;

-- ============================================================================
-- LEGAL DOCUMENT TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'terms_of_service',
        'privacy_policy',
        'fcra_disclosure',
        'credit_pull_authorization',
        'limited_poa',
        'service_agreement',
        'cancellation_policy',
        'payment_terms',
        'dispute_authorization'
    )),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- HTML content
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    expires_at DATE,
    is_active BOOLEAN DEFAULT true,
    requires_signature BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'es', -- es, en
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON legal_documents(is_active);

-- ============================================================================
-- INSERT DEFAULT LEGAL DOCUMENTS
-- ============================================================================

INSERT INTO legal_documents (document_type, title, content, version, effective_date, is_active, language)
VALUES 
(
    'fcra_disclosure',
    'Divulgación de la Ley de Informes Crediticios Justos (FCRA)',
    '<h2>Divulgación FCRA</h2>
    <p>Bajo la Ley de Informes Crediticios Justos (FCRA), usted tiene derecho a:</p>
    <ul>
        <li>Disputar información inexacta en su reporte de crédito</li>
        <li>Solicitar una copia gratuita de su reporte de crédito una vez al año</li>
        <li>Ser notificado cuando se tome una acción adversa basada en su reporte</li>
        <li>Limitar ofertas de crédito preaprobadas</li>
    </ul>
    <p>TriExpert Credit Repair actuará en su nombre para ejercer estos derechos.</p>',
    '1.0',
    CURRENT_DATE,
    true,
    'es'
),
(
    'credit_pull_authorization',
    'Autorización para Obtener Reportes de Crédito',
    '<h2>Autorización de Reporte de Crédito</h2>
    <p>Yo, el cliente abajo firmante, autorizo a TriExpert Credit Repair y sus representantes autorizados a:</p>
    <ul>
        <li>Obtener mis reportes de crédito de Experian, Equifax y TransUnion</li>
        <li>Revisar y analizar la información contenida en dichos reportes</li>
        <li>Actuar en mi nombre para disputar información incorrecta</li>
    </ul>
    <p>Esta autorización permanecerá vigente durante el período de servicio contratado.</p>',
    '1.0',
    CURRENT_DATE,
    true,
    'es'
),
(
    'limited_poa',
    'Poder Limitado (Limited Power of Attorney)',
    '<h2>Poder Limitado</h2>
    <p>Yo, el cliente abajo firmante, otorgo poder limitado a TriExpert Credit Repair para:</p>
    <ul>
        <li>Comunicarse con las agencias de crédito (Experian, Equifax, TransUnion) en mi nombre</li>
        <li>Enviar cartas de disputa relacionadas con información incorrecta</li>
        <li>Recibir y revisar respuestas de las agencias</li>
        <li>Comunicarse con acreedores respecto a disputas de crédito</li>
    </ul>
    <p>Este poder NO incluye autorización para:</p>
    <ul>
        <li>Abrir o cerrar cuentas de crédito</li>
        <li>Realizar transacciones financieras</li>
        <li>Modificar información personal en las cuentas</li>
    </ul>',
    '1.0',
    CURRENT_DATE,
    true,
    'es'
),
(
    'terms_of_service',
    'Términos de Servicio',
    '<h2>Términos de Servicio de TriExpert Credit Repair</h2>
    <h3>1. Servicios Ofrecidos</h3>
    <p>TriExpert Credit Repair proporciona servicios de reparación y mejora de crédito...</p>
    <h3>2. Obligaciones del Cliente</h3>
    <p>El cliente se compromete a proporcionar información veraz y completa...</p>
    <h3>3. Tarifas y Pagos</h3>
    <p>Los servicios tienen un costo mensual según el plan seleccionado...</p>
    <h3>4. Garantías y Limitaciones</h3>
    <p>No garantizamos resultados específicos ya que cada caso es único...</p>
    <h3>5. Cancelación</h3>
    <p>El cliente puede cancelar en cualquier momento con 30 días de aviso...</p>',
    '1.0',
    CURRENT_DATE,
    true,
    'es'
),
(
    'privacy_policy',
    'Política de Privacidad',
    '<h2>Política de Privacidad de TriExpert Credit Repair</h2>
    <h3>Información que Recopilamos</h3>
    <p>Recopilamos información personal incluyendo nombre, SSN, dirección, datos de empleo...</p>
    <h3>Uso de la Información</h3>
    <p>Su información se utiliza exclusivamente para proporcionar nuestros servicios...</p>
    <h3>Protección de Datos</h3>
    <p>Implementamos encriptación AES-256 y otras medidas de seguridad...</p>
    <h3>Compartir Información</h3>
    <p>No vendemos ni compartimos su información excepto según sea necesario para el servicio...</p>
    <h3>Sus Derechos</h3>
    <p>Tiene derecho a acceder, corregir y eliminar su información personal...</p>',
    '1.0',
    CURRENT_DATE,
    true,
    'es'
);

-- ============================================================================
-- CREATE ENCRYPTION FUNCTIONS (if pgcrypto is available)
-- ============================================================================

-- Note: In production, use application-level encryption or a proper key management system
-- These are placeholder functions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to generate SSN hash for verification
CREATE OR REPLACE FUNCTION hash_ssn(ssn_value TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(digest(ssn_value, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT TRIGGER FOR COMPLIANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_client_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        user_id,
        action,
        action_type,
        entity_type,
        entity_id,
        old_values,
        new_values,
        compliance_context
    ) VALUES (
        COALESCE(NEW.profile_verified_by, NEW.user_id),
        'profile_updated',
        CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
        'client_profiles',
        NEW.id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW),
        'fcra'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_client_profile_trigger ON client_profiles;
CREATE TRIGGER audit_client_profile_trigger
AFTER INSERT OR UPDATE ON client_profiles
FOR EACH ROW EXECUTE FUNCTION audit_client_profile_changes();

-- ============================================================================
-- UPDATE admin_settings constraint
-- ============================================================================

ALTER TABLE admin_settings DROP CONSTRAINT IF EXISTS admin_settings_setting_type_check;
ALTER TABLE admin_settings ADD CONSTRAINT admin_settings_setting_type_check 
CHECK (setting_type IN ('api_key', 'config', 'webhook', 'string', 'number', 'boolean'));
