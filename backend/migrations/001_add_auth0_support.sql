-- Migration: Add Auth0 support to users table
-- Run this migration on existing databases

-- Add auth0_id column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'auth0_id') THEN
        ALTER TABLE users ADD COLUMN auth0_id VARCHAR(255) UNIQUE;
    END IF;
END $$;

-- Add picture column if not exists (for Auth0 profile picture)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'picture') THEN
        ALTER TABLE users ADD COLUMN picture TEXT;
    END IF;
END $$;

-- Add email_verified column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add auth_provider column to track how user registered
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
        ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local' 
            CHECK (auth_provider IN ('local', 'auth0', 'google', 'github'));
    END IF;
END $$;

-- Make password_hash nullable for Auth0 users (they don't have local passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create index on auth0_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id) WHERE auth0_id IS NOT NULL;

-- Update existing local users to have auth_provider = 'local'
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;

COMMENT ON COLUMN users.auth0_id IS 'Auth0 user identifier (sub claim from JWT)';
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: local, auth0, google, github';
