-- Credit Repair SaaS - Migration: Add notifications, timeline, and milestones tables
-- Run this migration after init.sql

-- Notifications table for in-app and email notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client timeline for tracking all events in the credit repair process
CREATE TABLE IF NOT EXISTS client_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client milestones for tracking achievements
CREATE TABLE IF NOT EXISTS client_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    milestone_id VARCHAR(50) NOT NULL,
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, milestone_id)
);

-- Client process stage tracking
CREATE TABLE IF NOT EXISTS client_process_stage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_stage VARCHAR(50) NOT NULL DEFAULT 'onboarding',
    stage_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI generation logs for tracking AI-generated content
CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,
    provider VARCHAR(20) NOT NULL,
    model VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    generation_type VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_timeline_client_id ON client_timeline(client_id);
CREATE INDEX IF NOT EXISTS idx_client_timeline_created_at ON client_timeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_timeline_event_type ON client_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_client_milestones_client_id ON client_milestones(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_client_id ON ai_generation_logs(client_id);

-- Add columns to disputes table for AI generation tracking
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS generation_provider VARCHAR(20);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';

-- Insert initial timeline event for existing users
INSERT INTO client_timeline (client_id, event_type, title, description)
SELECT id, 'account_created', 'Cuenta creada', 'Bienvenido a Credit Repair Pro'
FROM users
WHERE role = 'client'
AND NOT EXISTS (
    SELECT 1 FROM client_timeline ct
    WHERE ct.client_id = users.id AND ct.event_type = 'account_created'
);

-- Initialize process stage for existing clients
INSERT INTO client_process_stage (client_id, current_stage)
SELECT id, 'onboarding'
FROM users
WHERE role = 'client'
AND NOT EXISTS (
    SELECT 1 FROM client_process_stage cps WHERE cps.client_id = users.id
);
