-- Melann Lending database upgrade (schema only, no record changes)
-- Safe for an existing PostgreSQL database. This script does not contain
-- INSERT, UPDATE, DELETE, TRUNCATE, DROP TABLE, or CASCADE statements.

BEGIN;

-- Existing-table compatibility columns used by the current application.
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE IF EXISTS collectors
    ADD COLUMN IF NOT EXISTS nickname TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS assigned_supervisor TEXT,
    ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE IF EXISTS loans
    ADD COLUMN IF NOT EXISTS area TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS barangay TEXT,
    ADD COLUMN IF NOT EXISTS full_address TEXT,
    ADD COLUMN IF NOT EXISTS contact_number TEXT,
    ADD COLUMN IF NOT EXISTS ai_priority TEXT DEFAULT 'Lowest Priority',
    ADD COLUMN IF NOT EXISTS promise_to_pay_date TEXT,
    ADD COLUMN IF NOT EXISTS follow_up_date TEXT,
    ADD COLUMN IF NOT EXISTS recurring_schedule JSONB,
    ADD COLUMN IF NOT EXISTS action_note TEXT,
    ADD COLUMN IF NOT EXISTS action_stage TEXT,
    ADD COLUMN IF NOT EXISTS date_release TEXT,
    ADD COLUMN IF NOT EXISTS principal NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS total_loan NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS payments
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'GOOD',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS remarks
    ADD COLUMN IF NOT EXISTS ptp_date TEXT,
    ADD COLUMN IF NOT EXISTS follow_up_date TEXT;

ALTER TABLE IF EXISTS demand_letters
    ADD COLUMN IF NOT EXISTS courrier TEXT;

ALTER TABLE IF EXISTS activity_logs
    ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE IF EXISTS visit_logs
    ADD COLUMN IF NOT EXISTS personnel_assigned TEXT DEFAULT '';

ALTER TABLE IF EXISTS visit_logs
    ADD COLUMN IF NOT EXISTS accompanying_personnel TEXT DEFAULT '';

ALTER TABLE IF EXISTS contact_logs
    ADD COLUMN IF NOT EXISTS personnel_assigned TEXT DEFAULT '';

-- New feature tables. CREATE TABLE IF NOT EXISTS preserves existing tables and rows.
CREATE TABLE IF NOT EXISTS supervisors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    branch TEXT NOT NULL,
    contact_number TEXT,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS action_personnel (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    branch TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Account Officer',
    contact_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visit_logs (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    collector_notes TEXT NOT NULL,
    client_comment TEXT DEFAULT '',
    visited_by_collector BOOLEAN DEFAULT FALSE,
    action TEXT NOT NULL DEFAULT 'Log Only',
    personnel_assigned TEXT DEFAULT '',
    accompanying_personnel TEXT DEFAULT '',
    logged_by TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_logs (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    contact_date TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'Call',
    notes TEXT NOT NULL,
    client_response TEXT DEFAULT '',
    has_response BOOLEAN DEFAULT FALSE,
    personnel_assigned TEXT DEFAULT '',
    logged_by TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deleted_loans (
    id TEXT PRIMARY KEY,
    original_loan_data JSONB NOT NULL,
    deleted_by TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    branch TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_batches (
    id TEXT PRIMARY KEY,
    cycle_start TEXT NOT NULL,
    cycle_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    detected_count INTEGER NOT NULL DEFAULT 0,
    payment_count INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_path TEXT NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    migrated_at TIMESTAMP WITH TIME ZONE,
    migrated_by TEXT,
    error TEXT
);

CREATE TABLE IF NOT EXISTS management_dispositions (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Pending Review',
    decided_by TEXT NOT NULL,
    decision_date TEXT NOT NULL
);

-- Current migration batching supports more than one source database.
DROP INDEX IF EXISTS migration_batches_cycle_unique;
CREATE UNIQUE INDEX IF NOT EXISTS migration_batches_source_cycle_unique
    ON migration_batches (source_path, cycle_start, cycle_end);

-- The current payment workflow permits separate same-date payments after
-- explicit user confirmation. OR numbers remain unique for audit safety.
ALTER TABLE IF EXISTS payments
    DROP CONSTRAINT IF EXISTS payments_loan_id_date_unique;
DROP INDEX IF EXISTS payments_loan_id_date_unique;

COMMIT;

-- Verification query: every count should remain exactly what it was before
-- this script, except new tables naturally begin at zero rows.
SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM loans) AS loans,
    (SELECT COUNT(*) FROM payments) AS payments,
    (SELECT COUNT(*) FROM collectors) AS collectors,
    (SELECT COUNT(*) FROM supervisors) AS supervisors,
    (SELECT COUNT(*) FROM action_personnel) AS action_personnel;
