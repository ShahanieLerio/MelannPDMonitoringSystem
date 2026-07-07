
-- Users Table: Permanent system records
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL, -- SUPER_ADMIN, NAVAL_USER, ORMOC_USER
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACTIVE, DEACTIVATED
    branch TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    status_history JSONB DEFAULT '[]'::jsonb
);

-- Collectors Table
CREATE TABLE IF NOT EXISTS collectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    address TEXT,
    assigned_supervisor TEXT,
    photo_url TEXT,
    branch TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS collectors_name_unique
ON collectors (UPPER(REGEXP_REPLACE(TRIM(name), '\s+', ' ', 'g')));

CREATE UNIQUE INDEX IF NOT EXISTS collectors_nickname_unique
ON collectors (UPPER(REGEXP_REPLACE(TRIM(nickname), '\s+', ' ', 'g')))
WHERE nickname IS NOT NULL AND TRIM(nickname) <> '';

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    collector TEXT NOT NULL,
    code TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    borrower_name TEXT NOT NULL,
    month_reported TEXT NOT NULL, -- YYYY-MM
    due_date TEXT NOT NULL,
    outstanding_balance NUMERIC(15, 2) NOT NULL,
    amount_collected NUMERIC(15, 2) DEFAULT 0,
    running_balance NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL, -- Paid, Moving, NM, NMSR
    location TEXT NOT NULL, -- L, NL
    area TEXT,
    city TEXT,
    barangay TEXT,


    full_address TEXT,
    contact_number TEXT,
    branch TEXT NOT NULL,
    ai_priority TEXT DEFAULT 'Lowest Priority',
    promise_to_pay_date TEXT,
    follow_up_date TEXT,
    recurring_schedule JSONB,
    action_note TEXT,
    action_stage TEXT,
    date_release TEXT,
    principal NUMERIC(15, 2),
    total_loan NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    or_number TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    balance_after NUMERIC(15, 2) NOT NULL,
    recorder TEXT NOT NULL,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'GOOD', -- GOOD, REVERSED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Required by the payment upsert in server.cjs.
-- One loan should only have one payment row per collection date.
CREATE UNIQUE INDEX IF NOT EXISTS payments_loan_id_date_unique
ON payments (loan_id, date);

-- Remarks Table
CREATE TABLE IF NOT EXISTS remarks (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    collector TEXT NOT NULL,
    ptp_date TEXT,
    follow_up_date TEXT
);

-- Demand Letters Table
CREATE TABLE IF NOT EXISTS demand_letters (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    collector_name TEXT NOT NULL,
    borrower_name TEXT NOT NULL,
    type TEXT NOT NULL, -- 1st, 2nd, 3rd
    date_prepared TEXT NOT NULL,
    date_received TEXT,
    follow_up_date TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    remarks TEXT,
    branch TEXT NOT NULL
);

-- Activity Logs (Loan History)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    module TEXT NOT NULL
);

-- Visit Logs (Close Monitoring)
CREATE TABLE IF NOT EXISTS visit_logs (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    collector_notes TEXT NOT NULL,
    client_comment TEXT DEFAULT '',
    visited_by_collector BOOLEAN DEFAULT FALSE,
    action TEXT NOT NULL DEFAULT 'Log Only',
    logged_by TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contact Logs (Action Tracker - Visit/Contact Log)
CREATE TABLE IF NOT EXISTS contact_logs (
    id TEXT PRIMARY KEY,
    loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
    contact_date TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'Call',
    notes TEXT NOT NULL,
    client_response TEXT DEFAULT '',
    has_response BOOLEAN DEFAULT FALSE,
    logged_by TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deleted Loans (Recycle Bin)
CREATE TABLE IF NOT EXISTS deleted_loans (
    id TEXT PRIMARY KEY,
    original_loan_data JSONB NOT NULL,
    deleted_by TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    branch TEXT NOT NULL
);

-- Read-only JCASH source migration batches
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

CREATE UNIQUE INDEX IF NOT EXISTS migration_batches_cycle_unique
ON migration_batches (cycle_start, cycle_end);

-- Management Dispositions (Action Tracker)
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
