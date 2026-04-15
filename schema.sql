
-- Users Table: Permanent system records
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
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
    branch TEXT NOT NULL
);

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
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    module TEXT NOT NULL
);
