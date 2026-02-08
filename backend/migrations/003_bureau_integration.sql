-- ============================================================================
-- PHASE 3: AUTOMATED CREDIT BUREAU INTEGRATION
-- Bureau connections, report snapshots, change detection, auto-pull config
-- ============================================================================

-- Bureau API connection configuration
CREATE TABLE IF NOT EXISTS bureau_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bureau VARCHAR(20) UNIQUE NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    api_url TEXT NOT NULL,
    credentials JSONB NOT NULL DEFAULT '{}',  -- Encrypted reference; actual secrets in admin_settings
    is_active BOOLEAN DEFAULT true,
    last_test_at TIMESTAMP,
    last_test_status VARCHAR(20) CHECK (last_test_status IN ('success', 'failed', 'pending')),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bureau report pull history (audit trail)
CREATE TABLE IF NOT EXISTS bureau_pull_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    pull_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (pull_type IN ('manual', 'automatic', 'scheduled', 'client_self')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    report_id VARCHAR(255),
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    permissible_purpose VARCHAR(50) DEFAULT 'review',
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit report snapshots — full normalized report stored as JSONB
CREATE TABLE IF NOT EXISTS credit_report_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    report_id VARCHAR(255),
    report_date DATE NOT NULL,
    report_data JSONB NOT NULL,
    score INTEGER CHECK (score >= 300 AND score <= 850),
    pull_id UUID REFERENCES bureau_pull_history(id) ON DELETE SET NULL,
    previous_snapshot_id UUID REFERENCES credit_report_snapshots(id) ON DELETE SET NULL,
    changes_detected JSONB DEFAULT '[]',
    changes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit report changes — individual changes detected between snapshots
CREATE TABLE IF NOT EXISTS credit_report_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bureau VARCHAR(20) NOT NULL CHECK (bureau IN ('experian', 'equifax', 'transunion')),
    snapshot_id UUID REFERENCES credit_report_snapshots(id) ON DELETE CASCADE,
    previous_snapshot_id UUID REFERENCES credit_report_snapshots(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('score', 'negative_item', 'account', 'inquiry', 'summary', 'public_record')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description TEXT NOT NULL,
    previous_value JSONB,
    current_value JSONB,
    delta NUMERIC,
    is_positive BOOLEAN DEFAULT false,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto-pull configuration per client
CREATE TABLE IF NOT EXISTS bureau_auto_pull_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
    bureaus JSONB NOT NULL DEFAULT '["experian", "equifax", "transunion"]',
    next_pull_date TIMESTAMP,
    last_pull_date TIMESTAMP,
    consecutive_failures INTEGER DEFAULT 0,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bureau_connections_bureau ON bureau_connections(bureau);
CREATE INDEX IF NOT EXISTS idx_bureau_pull_history_client ON bureau_pull_history(client_id);
CREATE INDEX IF NOT EXISTS idx_bureau_pull_history_bureau ON bureau_pull_history(bureau);
CREATE INDEX IF NOT EXISTS idx_bureau_pull_history_status ON bureau_pull_history(status);
CREATE INDEX IF NOT EXISTS idx_bureau_pull_history_created ON bureau_pull_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_report_snapshots_client ON credit_report_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_report_snapshots_bureau ON credit_report_snapshots(bureau);
CREATE INDEX IF NOT EXISTS idx_credit_report_snapshots_client_bureau ON credit_report_snapshots(client_id, bureau, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_report_snapshots_date ON credit_report_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_report_changes_client ON credit_report_changes(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_report_changes_bureau ON credit_report_changes(bureau);
CREATE INDEX IF NOT EXISTS idx_credit_report_changes_severity ON credit_report_changes(severity);
CREATE INDEX IF NOT EXISTS idx_credit_report_changes_category ON credit_report_changes(category);
CREATE INDEX IF NOT EXISTS idx_credit_report_changes_date ON credit_report_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_report_changes_snapshot ON credit_report_changes(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_bureau_auto_pull_config_client ON bureau_auto_pull_config(client_id);
CREATE INDEX IF NOT EXISTS idx_bureau_auto_pull_config_next ON bureau_auto_pull_config(next_pull_date) WHERE enabled = true;
