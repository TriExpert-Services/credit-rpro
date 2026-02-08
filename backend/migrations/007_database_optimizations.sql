-- Migration 007: Database Optimizations
-- Adds: optimized indexes, soft delete columns, composite indexes, partial indexes
-- Date: 2026-02-08

-- =====================================================
-- 1. SOFT DELETE COLUMNS (deleted_at)
-- =====================================================

DO $$ 
BEGIN
    -- Users soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Credit Items soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'credit_items' AND column_name = 'deleted_at') THEN
        ALTER TABLE credit_items ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Disputes soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'disputes' AND column_name = 'deleted_at') THEN
        ALTER TABLE disputes ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Documents soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'deleted_at') THEN
        ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Payments soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'deleted_at') THEN
        ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Invoices soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'deleted_at') THEN
        ALTER TABLE invoices ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Notifications soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' AND column_name = 'deleted_at') THEN
        ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Process Notes soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'process_notes' AND column_name = 'deleted_at') THEN
        ALTER TABLE process_notes ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;

    -- Notes soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notes' AND column_name = 'deleted_at') THEN
        ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;
END $$;

-- =====================================================
-- 2. OPTIMIZED COMPOSITE INDEXES (frequent query patterns)
-- =====================================================

-- Dashboard: credit_scores by client + bureau + date (covers DISTINCT ON queries)
CREATE INDEX IF NOT EXISTS idx_credit_scores_client_bureau_date 
    ON credit_scores(client_id, bureau, score_date DESC);

-- Dashboard: credit_items by client + status (covers GROUP BY status)
CREATE INDEX IF NOT EXISTS idx_credit_items_client_status 
    ON credit_items(client_id, status) WHERE deleted_at IS NULL;

-- Dashboard: disputes by client + status (covers GROUP BY status)
CREATE INDEX IF NOT EXISTS idx_disputes_client_status 
    ON disputes(client_id, status) WHERE deleted_at IS NULL;

-- Disputes: lookup by credit_item_id for JOIN on credit_items
CREATE INDEX IF NOT EXISTS idx_disputes_credit_item_id 
    ON disputes(credit_item_id) WHERE deleted_at IS NULL;

-- Payments: revenue calculations (completed payments by date)
CREATE INDEX IF NOT EXISTS idx_payments_completed_date 
    ON payments(payment_date DESC) WHERE payment_status = 'completed' AND deleted_at IS NULL;

-- Invoices: overdue lookups (unpaid by due_date)
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid_due 
    ON invoices(due_date) WHERE status IN ('pending', 'sent', 'overdue') AND deleted_at IS NULL;

-- Invoices: client + status for client invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_client_status 
    ON invoices(client_id, status) WHERE deleted_at IS NULL;

-- Notifications: unread per recipient (very frequent query)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
    ON notifications(recipient_id, created_at DESC) WHERE is_read = false AND deleted_at IS NULL;

-- Users: active clients listing (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_users_active_clients 
    ON users(created_at DESC) WHERE role = 'client' AND deleted_at IS NULL;

-- Client profiles: subscription status lookups
CREATE INDEX IF NOT EXISTS idx_client_profiles_subscription 
    ON client_profiles(subscription_status) WHERE subscription_status = 'active';

-- Activity log: recent activity per user
CREATE INDEX IF NOT EXISTS idx_activity_log_user_recent 
    ON activity_log(user_id, created_at DESC);

-- Onboarding: pending status for staff view
CREATE INDEX IF NOT EXISTS idx_onboarding_pending 
    ON client_onboarding(status) WHERE status = 'in_progress';

-- Process notes: client + stage + importance
CREATE INDEX IF NOT EXISTS idx_process_notes_client_stage 
    ON process_notes(client_id, process_stage, created_at DESC) WHERE deleted_at IS NULL;

-- Documents: client + category (frequent filter)
CREATE INDEX IF NOT EXISTS idx_documents_client_category 
    ON documents(client_id, document_category) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. PARTIAL INDEXES FOR SOFT DELETES
-- =====================================================

-- Ensure existing queries that filter non-deleted rows benefit from partial indexes
CREATE INDEX IF NOT EXISTS idx_users_not_deleted 
    ON users(id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_credit_items_not_deleted 
    ON credit_items(client_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_not_deleted 
    ON disputes(client_id, created_at DESC) WHERE deleted_at IS NULL;

-- =====================================================
-- 4. TEXT SEARCH INDEX for creditor name lookups
-- =====================================================

-- Enable trigram extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_credit_items_creditor_trgm 
    ON credit_items USING gin (creditor_name gin_trgm_ops);
