
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
require('dotenv').config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const UPLOAD_ROOT = path.join(__dirname, 'public', 'uploads');
const COLLECTOR_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'collectors');
fs.mkdirSync(COLLECTOR_UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test DB Connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Successfully connected to Local PostgreSQL');

    client.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS photo_url TEXT', (err) => {
        if (err) console.error('Failed to ensure collectors photo column', err.message);
    });
    client.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS assigned_supervisor TEXT', (err) => {
        if (err) console.error('Failed to ensure collectors assigned supervisor column', err.message);
    });
    client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT', (err) => {
        if (err) console.error('Failed to ensure users password hash column', err.message);
    });

    // Seed default admin if table is empty
    client.query('SELECT COUNT(*) FROM users', (err, result) => {
        if (!err && parseInt(result.rows[0].count) === 0) {
            console.log('Seeding default admin user...');
            const now = new Date().toISOString();
            const adminHistory = JSON.stringify([{ status: 'ACTIVE', updatedAt: now, updatedBy: 'System' }]);
            client.query(
                'INSERT INTO users (id, username, full_name, role, status, branch, created_at, created_by, status_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                ['1', 'admin', 'System Administrator', 'SUPER_ADMIN', 'ACTIVE', 'All Branches', now, 'System', adminHistory]
            );
        }
    });

    release();
});

    // Create deleted_loans table if it doesn't exist
    pool.query(`
        CREATE TABLE IF NOT EXISTS deleted_loans (
            id TEXT PRIMARY KEY,
            original_loan_data JSONB NOT NULL,
            deleted_by TEXT NOT NULL,
            deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            reason TEXT,
            branch TEXT NOT NULL
        )
    `, (err) => {
        if (err) console.error('Failed to create deleted_loans table', err.message);
    });

    // Create management_dispositions table if it doesn't exist
    pool.query(`
        CREATE TABLE IF NOT EXISTS management_dispositions (
            id TEXT PRIMARY KEY,
            loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            reason TEXT NOT NULL,
            evidence JSONB DEFAULT '[]'::jsonb,
            status TEXT NOT NULL DEFAULT 'Pending Review',
            decided_by TEXT NOT NULL,
            decision_date TEXT NOT NULL
        )
    `, (err) => {
        if (err) console.error('Failed to create management_dispositions table', err.message);
        else console.log('management_dispositions table ready.');
    });

// Generic Query Handler
const query = (text, params) => pool.query(text, params);

const JCASHDB_PATH = process.env.JCASHDB_PATH || '\\\\SERVERPC\\LendingV2Melan\\db\\jcashdb.mdb';
const JCASHDB_PASSWORD = process.env.JCASHDB_PASSWORD || '';
const JCASHDB_BRANCH = process.env.JCASHDB_BRANCH || 'Ormoc Branch';
const MIGRATION_ANCHOR_START = process.env.JCASHDB_CYCLE_ANCHOR_START || '2016-01-01';
const MIGRATION_FIRST_CYCLE_END = process.env.JCASHDB_FIRST_CYCLE_END || '2026-03-31';
const MIGRATION_TEMP_DIR = process.env.JCASHDB_SCAN_TEMP_DIR || 'C:\\tmp';
const ACTIVE_PORTFOLIO_MATURITY_START = '2016-01-01';
const ACTIVE_PORTFOLIO_MATURITY_END = '2026-03-31';
const JCASH_MIGRATION_PAYMENT_REMARK = 'Migrated from jcashdb.mdb';

const ensureMigrationTables = async () => {
    await query(`
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
        )
    `);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS migration_batches_cycle_unique
        ON migration_batches (cycle_start, cycle_end)
    `);
};

ensureMigrationTables().catch(err => {
    console.error('Failed to ensure migration tables', err.message);
});

const toDateOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
        return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const isMaturityInActivePortfolioRange = (value) => {
    const dateOnly = toDateOnly(value);
    return Boolean(dateOnly && dateOnly >= ACTIVE_PORTFOLIO_MATURITY_START && dateOnly <= ACTIVE_PORTFOLIO_MATURITY_END);
};

const getOutOfRangeLoans = (loans) => loans.filter(loan => !isMaturityInActivePortfolioRange(loan.dueDate));

const addDays = (dateStr, days) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const getCompletedMigrationCycles = (todayStr = new Date().toISOString().slice(0, 10)) => {
    const cycles = [];
    let start = MIGRATION_ANCHOR_START;
    let end = MIGRATION_FIRST_CYCLE_END;

    while (end < todayStr) {
        cycles.push({ start, end });
        start = addDays(end, 1);
        end = addDays(start, 44);
    }

    return cycles;
};

const pick = (row, candidates, fallback = '') => {
    for (const key of candidates) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
    }
    const normalized = Object.fromEntries(Object.keys(row).map(key => [key.toLowerCase(), key]));
    for (const key of candidates) {
        const actual = normalized[String(key).toLowerCase()];
        if (actual && row[actual] !== undefined && row[actual] !== null && String(row[actual]).trim() !== '') return row[actual];
    }
    return fallback;
};

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBranch = (value) => {
    const text = String(value || '').toLowerCase();
    if (text.includes('ormoc') || text === '2') return 'Ormoc Branch';
    if (text.includes('naval') || text === '1') return 'Naval Branch';
    return 'Naval Branch';
};

const buildBorrowerName = (firstName, lastName, fallback) => {
    const first = String(firstName || '').trim();
    const last = String(lastName || '').trim();
    if (last && first) return `${last}, ${first}`;
    return String(fallback || `${first} ${last}` || 'Unnamed Client').trim();
};

const getReportedMonthForDueDate = (dueDateStr) => {
    if (!dueDateStr) return '';
    const [yearPart, monthPart, dayPart] = String(dueDateStr).split('-').map(Number);
    if (!yearPart || !monthPart || !dayPart) return String(dueDateStr).slice(0, 7);
    const reported = new Date(Date.UTC(yearPart, monthPart + 1, dayPart));
    return `${reported.getUTCFullYear()}-${String(reported.getUTCMonth() + 1).padStart(2, '0')}`;
};

const isGoodSourcePayment = (payment) => {
    const status = String(pick(payment, ['Status', 'PaymentStatus', 'PayStatus', 'Remarks'], 'GOOD')).trim().toUpperCase();
    if (status.includes('REVERSE') || status.includes('VOID') || status.includes('CANCEL')) return false;
    return !status || status === 'GOOD' || status === 'OK' || status.includes('POST');
};

const isMigrationReadySourceLoanStatus = (value) => {
    const status = String(value || '').trim().toUpperCase();
    return status === 'GOOD' || status === 'NMSR';
};

const isGoodSourceLoan = (loan) => {
    const status = String(pick(loan, ['Status', 'LoanStatus'], '')).trim().toUpperCase();
    const loanStatus = String(pick(loan, ['LoanStatus', 'Status'], '')).trim().toUpperCase();
    if (status.includes('FULL') || status === 'PAID' || status.includes('REVERSE')) return false;
    if (loanStatus.includes('FULL') || loanStatus === 'PAID' || loanStatus.includes('REVERSE')) return false;
    return isMigrationReadySourceLoanStatus(status) && isMigrationReadySourceLoanStatus(loanStatus);
};

const getSortablePaymentId = (payment) => {
    const rawId = String(pick(payment, ['ID', 'id', 'PaymentID', 'PayID'], '')).trim();
    const match = rawId.match(/\d+/);
    return match ? Number(match[0]) : 0;
};

const sortSourcePayments = (payments) =>
    [...(payments || [])].sort((a, b) => {
        const dateA = a.date || toDateOnly(pick(a, ['Date', 'PaymentDate', 'DatePaid', 'TransDate'])) || '';
        const dateB = b.date || toDateOnly(pick(b, ['Date', 'PaymentDate', 'DatePaid', 'TransDate'])) || '';
        const dateCompare = String(dateA).localeCompare(String(dateB));
        if (dateCompare !== 0) return dateCompare;
        return getSortablePaymentId(a) - getSortablePaymentId(b);
    });

const mapSourcePayment = (payment, loanId) => {
    const rawId = String(pick(payment, ['ID', 'PaymentID', 'PayID', 'ORNumber', 'ORNo'], `${loanId}-${pick(payment, ['Date', 'PaymentDate'], '')}`)).trim();
    const date = toDateOnly(pick(payment, ['Date', 'PaymentDate', 'DatePaid', 'TransDate']));
    const amount = parseNumber(pick(payment, ['PaymentsMade', 'Amount', 'Payment', 'PaidAmount']));
    const balanceAfter = parseNumber(pick(payment, ['NewBalance', 'BalanceAfter', 'Balance', 'RunningBalance']));

    if (!date || amount <= 0) return null;

    return {
        id: `jcash-payment-${rawId}`,
        loanId,
        amount,
        orNumber: String(pick(payment, ['ORNumber', 'ORNo', 'ReceiptNo'], `JCASH-${rawId}`)).trim(),
        date,
        balanceAfter,
        recorder: String(pick(payment, ['User', 'Recorder', 'EncodedBy', 'Collector'], 'JCASH')).trim(),
        remarks: 'Migrated from jcashdb.mdb',
        status: 'GOOD',
        createdAt: new Date().toISOString()
    };
};

const inferOriginalTotalLoan = (loan, payments) => {
    const paymentRows = (payments || [])
        .filter(payment => payment && Number.isFinite(Number(payment.amount)) && Number.isFinite(Number(payment.balanceAfter)))
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    if (paymentRows.length === 0) return Number(loan.totalLoan || 0);

    const firstPayment = paymentRows[0];
    const firstOpeningBalance = Number(firstPayment.balanceAfter) + Number(firstPayment.amount);
    const totalPaidPlusCurrentBalance = paymentRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
        Number(loan.runningBalance || paymentRows[paymentRows.length - 1].balanceAfter || 0);

    return Math.max(
        Number(loan.totalLoan || 0),
        Number(loan.principal || 0),
        firstOpeningBalance,
        totalPaidPlusCurrentBalance
    );
};

const mapSourceLoan = (loan) => {
    const sourceLoanId = String(pick(loan, ['LoanID', 'ID', 'loan_id'])).trim();
    const code = String(pick(loan, ['Code', 'AccountNo', 'LoanCode'], sourceLoanId)).trim();
    const firstName = String(pick(loan, ['FirstName', 'FName', 'CustomerFname'], '')).trim();
    const lastName = String(pick(loan, ['Customer', 'LastName', 'LName', 'CustomerLname'], '')).trim();
    const borrowerName = buildBorrowerName(firstName, lastName, pick(loan, ['BorrowerName', 'Name', 'ClientName'], 'Unnamed Client'));
    const totalLoan = parseNumber(pick(loan, ['Total', 'TotalLoan', 'LoanAmount']));
    const principal = parseNumber(pick(loan, ['Principal', 'PrincipalAmount', 'PrincipalLoan']));
    const amountCollected = parseNumber(pick(loan, ['TotalPayment', 'TotalPayments', 'AmountCollected']));
    const runningBalance = parseNumber(pick(loan, ['Balance', 'TotalBalance', 'RunningBalance'], totalLoan - amountCollected));
    const dueDate = toDateOnly(pick(loan, ['Maturity', 'DueDate', 'DateDue']));
    const dateRelease = toDateOnly(pick(loan, ['DateRelease', 'DateReleased', 'ReleaseDate']));

    return {
        sourceLoanId,
        loan: {
            id: sourceLoanId,
            collector: String(pick(loan, ['CollectorFname', 'Collector', 'CollectorName'], 'UNASSIGNED')).trim() || 'UNASSIGNED',
            code,
            firstName: firstName || borrowerName.split(' ').slice(0, -1).join(' ') || 'Unknown',
            lastName: lastName || borrowerName.split(' ').slice(-1)[0] || 'Unknown',
            borrowerName,
            monthReported: getReportedMonthForDueDate(dueDate),
            dueDate: dueDate || '',
            dateRelease: dateRelease || '',
            principal: principal || 0,
            totalLoan: totalLoan || 0,
            outstandingBalance: totalLoan || runningBalance,
            amountCollected,
            runningBalance,
            status: runningBalance <= 0 ? 'Paid' : 'M',
            location: 'L',
            area: String(pick(loan, ['Area'], 'N/A')),
            city: String(pick(loan, ['City'], 'N/A')),
            barangay: String(pick(loan, ['Barangay', 'Brgy'], 'N/A')),
            fullAddress: String(pick(loan, ['Address', 'FullAddress'], '')),
            contactNumber: String(pick(loan, ['ContactNumber', 'Cellphone', 'Phone'], 'N/A')),
            branch: JCASHDB_BRANCH,
            aiPriority: 'Lowest Priority',
            promiseToPayDate: null,
            followUpDate: null,
            recurringSchedule: null,
            actionNote: null,
            actionStage: null
        }
    };
};

const psSingleQuoted = (value) => String(value).replace(/'/g, "''");

const toAccessDateLiteral = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
};

const createJcashSnapshotCopy = () => {
    fs.mkdirSync(MIGRATION_TEMP_DIR, { recursive: true });
    const target = path.join(MIGRATION_TEMP_DIR, `jcashdb-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mdb`);
    // Source is never opened for writes. We copy the live MDB first, then all
    // Access queries run against this local snapshot.
    fs.copyFileSync(JCASHDB_PATH, target);
    return target;
};

const readJcashCycleSnapshot = (cycleStart, cycleEnd) => new Promise((resolve, reject) => {
    let snapshotPath;
    try {
        snapshotPath = createJcashSnapshotCopy();
    } catch (copyErr) {
        return reject(new Error(`Unable to create read-only scan snapshot from ${JCASHDB_PATH}: ${copyErr.message}`));
    }

    const accessCycleStart = toAccessDateLiteral(cycleStart);
    const accessCycleEnd = toAccessDateLiteral(cycleEnd);
    const script = `
$ErrorActionPreference = 'Stop'
$conn = New-Object -ComObject ADODB.Connection
$conn.ConnectionString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${psSingleQuoted(snapshotPath)};Jet OLEDB:Database Password=${psSingleQuoted(JCASHDB_PASSWORD)};Mode=Read;'
function RowsToArray($rs, $dateField, $startDate, $endDate) {
  $rows = New-Object System.Collections.ArrayList
  while (-not $rs.EOF) {
    $include = $true
    if ($dateField) {
      $rawDate = $rs.Fields.Item($dateField).Value
      $include = $false
      if ($null -ne $rawDate -and "$rawDate".Trim() -ne '') {
        try {
          $parsedDate = [datetime]$rawDate
          $include = ($parsedDate.Date -ge $startDate.Date -and $parsedDate.Date -le $endDate.Date)
        } catch {
          $include = $false
        }
      }
    }
    $row = @{}
    if ($include) {
      for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
        $field = $rs.Fields.Item($i)
        if ($field.Value -is [datetime]) {
          $row[$field.Name] = ([datetime]$field.Value).ToString('yyyy-MM-dd')
        } else {
          $row[$field.Name] = $field.Value
        }
      }
      [void]$rows.Add((New-Object psobject -Property $row))
    }
    [void]$rs.MoveNext()
  }
  return $rows.ToArray()
}
$conn.Open()
$loanSql = "SELECT * FROM tblLoan WHERE [Maturity] >= #${accessCycleStart}# AND [Maturity] <= #${accessCycleEnd}# AND UCase(Trim([Status] & '')) IN ('GOOD','NMSR') AND UCase(Trim([LoanStatus] & '')) IN ('GOOD','NMSR')"
$cycleStart = [datetime]'${cycleStart}'
$cycleEnd = [datetime]'${cycleEnd}'
$loanRs = $conn.Execute($loanSql)
$loanRows = RowsToArray -rs $loanRs -dateField $null -startDate $cycleStart -endDate $cycleEnd
$paymentRows = New-Object System.Collections.ArrayList
$loanIds = @($loanRows | ForEach-Object { "$($_.LoanID)".Trim() } | Where-Object { $_ -match '^\\d+$' })
if ($loanIds.Count -gt 0) {
  for ($offset = 0; $offset -lt $loanIds.Count; $offset += 40) {
    $chunk = @($loanIds[$offset..([Math]::Min($offset + 39, $loanIds.Count - 1))])
    $ids = ($chunk | ForEach-Object { "$_".Trim() }) -join ','
    $paymentSql = "SELECT * FROM tblPayment WHERE [LoanID] IN ($ids) AND [Status] = 'Good'"
    $paymentRs = $conn.Execute($paymentSql)
    $chunkPaymentRows = RowsToArray -rs $paymentRs -dateField $null -startDate $cycleStart -endDate $cycleEnd
    foreach ($paymentRow in $chunkPaymentRows) {
      [void]$paymentRows.Add($paymentRow)
    }
  }
}
$loanCodes = @($loanRows | ForEach-Object { "$($_.Code)".Trim() } | Where-Object { $_ -match '^\\d+$' })
$customerRows = New-Object System.Collections.ArrayList
if ($loanCodes.Count -gt 0) {
  for ($offset = 0; $offset -lt $loanCodes.Count; $offset += 40) {
    $chunk = @($loanCodes[$offset..([Math]::Min($offset + 39, $loanCodes.Count - 1))])
    $codes = ($chunk | ForEach-Object { "$_".Trim() }) -join ','
    $custSql = "SELECT Code, Address, PhoneNumber FROM tblCustomer WHERE [Code] IN ($codes)"
    $custRs = $conn.Execute($custSql)
    $chunkCustRows = RowsToArray -rs $custRs -dateField $null -startDate $cycleStart -endDate $cycleEnd
    foreach ($custRow in $chunkCustRows) {
      [void]$customerRows.Add($custRow)
    }
  }
}
$conn.Close()
@{ loans = $loanRows; payments = $paymentRows.ToArray(); customers = $customerRows.ToArray() } | ConvertTo-Json -Depth 8 -Compress
`;

    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { maxBuffer: 1024 * 1024 * 100, timeout: 180000 }, (err, stdout, stderr) => {
        try {
            if (snapshotPath && fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
        } catch (cleanupErr) {
            console.warn('Failed to remove JCASH scan snapshot:', cleanupErr.message);
        }

        if (err) return reject(new Error(stderr || err.message));
        try {
            const parsed = JSON.parse(stdout || '{}');
            resolve({
                loans: Array.isArray(parsed.loans) ? parsed.loans : (parsed.loans ? [parsed.loans] : []),
                payments: Array.isArray(parsed.payments) ? parsed.payments : (parsed.payments ? [parsed.payments] : []),
                customers: Array.isArray(parsed.customers) ? parsed.customers : (parsed.customers ? [parsed.customers] : [])
            });
        } catch (parseErr) {
            reject(new Error(`Unable to parse jcashdb.mdb output: ${parseErr.message}`));
        }
    });
});

const normalizeCollectorKey = (collector) =>
    String(collector || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();

const getCollectorIdentityCandidates = ({ name, nickname }) =>
    [name, nickname]
        .map(normalizeCollectorKey)
        .filter(Boolean);

const assertCollectorIsUnique = async ({ name, nickname }, excludeId) => {
    const candidateKeys = new Set(getCollectorIdentityCandidates({ name, nickname }));
    if (candidateKeys.size === 0) return;

    const result = await query('SELECT id, name, nickname FROM collectors');
    const duplicate = result.rows.find((collector) => {
        if (excludeId && collector.id === excludeId) return false;
        return getCollectorIdentityCandidates(collector).some(key => candidateKeys.has(key));
    });

    if (duplicate) {
        const error = new Error('Collector already exists');
        error.status = 409;
        throw error;
    }
};

const getPhotoExtension = (mimeType) => {
    const extensionMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return extensionMap[mimeType] || 'png';
};

const toSafeFileSegment = (value) =>
    String(value || 'collector')
        .replace(/[^a-z0-9_-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'collector';

const persistCollectorPhoto = (collectorId, photoUrl) => {
    if (!photoUrl) return null;
    if (!photoUrl.startsWith('data:image/')) return photoUrl;

    const match = photoUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return photoUrl;

    const [, mimeType, base64Data] = match;
    const extension = getPhotoExtension(mimeType);
    const fileName = `${toSafeFileSegment(collectorId)}-${Date.now()}.${extension}`;
    const filePath = path.join(COLLECTOR_UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return `/uploads/collectors/${fileName}`;
};

// --- API ENDPOINTS ---

// Users
app.get('/api/users', async (req, res) => {
    try {
        const result = await query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    const { id, username, fullName, passwordHash, role, status, branch, createdAt, createdBy, statusHistory } = req.body;
    try {
        await query(
            'INSERT INTO users (id, username, full_name, password_hash, role, status, branch, created_at, created_by, status_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [id, username, fullName, passwordHash || null, role, status, branch, createdAt, createdBy, JSON.stringify(statusHistory)]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, statusHistory } = req.body;
    try {
        await query('UPDATE users SET status = $1, status_history = $2 WHERE id = $3', [status, JSON.stringify(statusHistory), id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id/profile', async (req, res) => {
    const { id } = req.params;
    const { fullName } = req.body;
    if (!fullName || !String(fullName).trim()) {
        return res.status(400).json({ error: 'Full name is required.' });
    }

    try {
        await query('UPDATE users SET full_name = $1 WHERE id = $2', [String(fullName).trim(), id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id/password', async (req, res) => {
    const { id } = req.params;
    const { passwordHash } = req.body;
    if (!passwordHash) {
        return res.status(400).json({ error: 'Password hash is required.' });
    }

    try {
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Loans
app.get('/api/loans', async (req, res) => {
    try {
        const result = await query(`
            SELECT l.*
            FROM loans l
            WHERE (l.due_date >= $1 AND l.due_date <= $2)
               OR EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.loan_id = l.id
                      AND p.remarks = $3
               )
               OR (
                    l.branch = $4
                    AND l.id ~ '^[0-9]+$'
                    AND (
                        l.status = 'NMSR'
                        OR COALESCE(l.amount_collected, 0) = 0
                    )
               )
            ORDER BY l.last_name ASC, l.first_name ASC
        `, [ACTIVE_PORTFOLIO_MATURITY_START, ACTIVE_PORTFOLIO_MATURITY_END, JCASH_MIGRATION_PAYMENT_REMARK, JCASHDB_BRANCH]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/loans/bulk', async (req, res) => {
    const loans = req.body;
    if (!Array.isArray(loans)) return res.status(400).json({ error: 'Payload must be an array' });
    const outOfRangeLoans = getOutOfRangeLoans(loans);
    if (outOfRangeLoans.length > 0) {
        return res.status(400).json({
            error: `Normal client imports only allow Maturity Date from ${ACTIVE_PORTFOLIO_MATURITY_START} to ${ACTIVE_PORTFOLIO_MATURITY_END}. Use JCASH Migration for other maturity dates.`,
            rejectedCodes: outOfRangeLoans.map(loan => loan.code || loan.id).slice(0, 25)
        });
    }

    console.log(`Starting bulk import of ${loans.length} records...`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const loan of loans) {
            const { id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage, dateRelease, principal, totalLoan } = loan;
            try {
                const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
                await client.query(
                    'INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage, date_release, principal, total_loan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)',
                    [id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, scheduleVal, actionNote ?? null, actionStage ?? null, dateRelease ?? null, principal ?? null, totalLoan ?? null]
                );
            } catch (innerErr) {
                console.error(`Error inserting loan ${code} (${borrowerName}):`, innerErr.message);
                throw innerErr; // Re-throw to trigger rollback
            }
        }
        await client.query('COMMIT');
        console.log(`Bulk import successful: ${loans.length} records.`);
        res.json({ success: true, count: loans.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Bulk Import Transaction Failed:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/loans', async (req, res) => {
    const { id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage, dateRelease, principal, totalLoan } = req.body;
    if (!isMaturityInActivePortfolioRange(dueDate)) {
        return res.status(400).json({ error: `Maturity Date must be from ${ACTIVE_PORTFOLIO_MATURITY_START} to ${ACTIVE_PORTFOLIO_MATURITY_END}. Use JCASH Migration for other maturity dates.` });
    }
    try {
        const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
        await query(
            'INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage, date_release, principal, total_loan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)',
            [id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, scheduleVal, actionNote ?? null, actionStage ?? null, dateRelease ?? null, principal ?? null, totalLoan ?? null]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Client Code already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/loans/:id', async (req, res) => {
    const { id } = req.params;
    const { collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage, dateRelease, principal, totalLoan } = req.body;
    try {
        const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
        await query(
            'UPDATE loans SET collector=$1, first_name=$2, last_name=$3, borrower_name=$4, due_date=$5, outstanding_balance=$6, amount_collected=$7, running_balance=$8, status=$9, location=$10, area=$11, city=$12, barangay=$13, full_address=$14, contact_number=$15, branch=$16, ai_priority=$17, promise_to_pay_date=$18, follow_up_date=$19, month_reported=$20, recurring_schedule=$21, code=$23, action_note=$24, action_stage=$25, date_release=$26, principal=$27, total_loan=$28 WHERE id=$22',
            [collector, firstName, lastName, borrowerName, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, monthReported ?? null, scheduleVal, id, code ?? null, actionNote ?? null, actionStage ?? null, dateRelease ?? null, principal ?? null, totalLoan ?? null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/loans/:id', async (req, res) => {
    const { id } = req.params;
    const deletedBy = (req.body && req.body.deletedBy) || 'System';
    const reason = (req.body && req.body.reason) || 'Deleted via API';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch the loan first so we can archive it
        const loanResult = await client.query('SELECT * FROM loans WHERE id = $1', [id]);
        if (loanResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Loan not found' });
        }
        const loan = loanResult.rows[0];

        // Fetch related payments, remarks, and history for full archive
        const [paymentsResult, remarksResult, logsResult] = await Promise.all([
            client.query('SELECT * FROM payments WHERE loan_id = $1', [id]),
            client.query('SELECT * FROM remarks WHERE loan_id = $1', [id]),
            client.query('SELECT * FROM activity_logs WHERE loan_id = $1', [id])
        ]);

        const originalLoanData = {
            id: loan.id,
            collector: loan.collector,
            code: loan.code,
            firstName: loan.first_name,
            lastName: loan.last_name,
            borrowerName: loan.borrower_name,
            monthReported: loan.month_reported,
            dueDate: loan.due_date,
            outstandingBalance: parseFloat(loan.outstanding_balance) || 0,
            amountCollected: parseFloat(loan.amount_collected) || 0,
            runningBalance: parseFloat(loan.running_balance) || 0,
            status: loan.status,
            location: loan.location,
            area: loan.area,
            city: loan.city,
            barangay: loan.barangay,
            fullAddress: loan.full_address,
            contactNumber: loan.contact_number,
            branch: loan.branch,
            aiPriority: loan.ai_priority,
            promiseToPayDate: loan.promise_to_pay_date,
            followUpDate: loan.follow_up_date,
            recurringSchedule: loan.recurring_schedule,
            actionNote: loan.action_note,
            actionStage: loan.action_stage,
            dateRelease: loan.date_release,
            principal: parseFloat(loan.principal) || 0,
            totalLoan: parseFloat(loan.total_loan) || 0,
            payments: paymentsResult.rows.map(p => ({
                id: p.id, loanId: p.loan_id, amount: parseFloat(p.amount) || 0,
                orNumber: p.or_number, date: p.date, balanceAfter: parseFloat(p.balance_after) || 0,
                recorder: p.recorder, remarks: p.remarks, status: p.status, createdAt: p.created_at
            })),
            remarks: remarksResult.rows.map(r => ({
                id: r.id, text: r.text, collector: r.collector,
                timestamp: r.timestamp, ptpDate: r.ptp_date, followUpDate: r.follow_up_date
            })),
            history: logsResult.rows.map(h => ({
                id: h.id, type: h.type, description: h.description,
                user: h.user_name, role: h.user_role, module: h.module, timestamp: h.timestamp
            }))
        };

        // Archive to recycle bin instead of hard-deleting
        await client.query(
            'INSERT INTO deleted_loans (id, original_loan_data, deleted_by, reason, branch) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
            [id, JSON.stringify(originalLoanData), deletedBy, reason, loan.branch]
        );

        // Then delete from loans
        await client.query('DELETE FROM loans WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/loans/branch/:branch/wipe', async (req, res) => {
    const { branch } = req.params;
    try {
        let result;
        if (branch === 'All Branches') {
            result = await query('DELETE FROM loans');
        } else {
            result = await query('DELETE FROM loans WHERE branch = $1', [branch]);
        }
        res.json({ success: true, count: result.rowCount || 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recycle Bin
app.get('/api/recycle_bin', async (req, res) => {
    try {
        const result = await query('SELECT * FROM deleted_loans ORDER BY deleted_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/recycle_bin', async (req, res) => {
    const { id, originalLoanData, deletedBy, reason, branch } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO deleted_loans (id, original_loan_data, deleted_by, reason, branch)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
                original_loan_data = EXCLUDED.original_loan_data,
                deleted_by = EXCLUDED.deleted_by,
                reason = EXCLUDED.reason,
                branch = EXCLUDED.branch,
                deleted_at = CURRENT_TIMESTAMP`,
            [id, JSON.stringify(originalLoanData), deletedBy, reason, branch]
        );

        await client.query('DELETE FROM loans WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/recycle_bin/:id/restore', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query('SELECT original_loan_data FROM deleted_loans WHERE id = $1', [id]);
        if (result.rows.length === 0) throw new Error("Loan not found in recycle bin");

        const archivedLoan = result.rows[0].original_loan_data || {};
        const loan = {
            ...archivedLoan,
            firstName: archivedLoan.firstName ?? archivedLoan.first_name ?? '',
            lastName: archivedLoan.lastName ?? archivedLoan.last_name ?? '',
            borrowerName: archivedLoan.borrowerName ?? archivedLoan.borrower_name ?? `${archivedLoan.last_name || archivedLoan.lastName || ''}, ${archivedLoan.first_name || archivedLoan.firstName || ''}`.trim(),
            monthReported: archivedLoan.monthReported ?? archivedLoan.month_reported ?? '',
            dueDate: archivedLoan.dueDate ?? archivedLoan.due_date ?? '',
            outstandingBalance: archivedLoan.outstandingBalance ?? archivedLoan.outstanding_balance ?? 0,
            amountCollected: archivedLoan.amountCollected ?? archivedLoan.amount_collected ?? 0,
            runningBalance: archivedLoan.runningBalance ?? archivedLoan.running_balance ?? 0,
            fullAddress: archivedLoan.fullAddress ?? archivedLoan.full_address ?? '',
            contactNumber: archivedLoan.contactNumber ?? archivedLoan.contact_number ?? null,
            aiPriority: archivedLoan.aiPriority ?? archivedLoan.ai_priority ?? null,
            promiseToPayDate: archivedLoan.promiseToPayDate ?? archivedLoan.promise_to_pay_date ?? null,
            followUpDate: archivedLoan.followUpDate ?? archivedLoan.follow_up_date ?? null,
            recurringSchedule: archivedLoan.recurringSchedule ?? archivedLoan.recurring_schedule ?? null,
            actionNote: archivedLoan.actionNote ?? archivedLoan.action_note ?? null,
            actionStage: archivedLoan.actionStage ?? archivedLoan.action_stage ?? null,
            dateRelease: archivedLoan.dateRelease ?? archivedLoan.date_release ?? null,
            totalLoan: archivedLoan.totalLoan ?? archivedLoan.total_loan ?? null,
            payments: archivedLoan.payments || [],
            remarks: archivedLoan.remarks || [],
            history: archivedLoan.history || []
        };
        const scheduleVal = loan.recurringSchedule ? (typeof loan.recurringSchedule === 'string' ? loan.recurringSchedule : JSON.stringify(loan.recurringSchedule)) : null;
        const restorePayments = (loan.payments || []).map(p => ({
            id: p.id,
            loanId: p.loanId ?? p.loan_id ?? loan.id,
            amount: p.amount,
            orNumber: p.orNumber ?? p.or_number,
            date: p.date,
            balanceAfter: p.balanceAfter ?? p.balance_after ?? 0,
            recorder: p.recorder,
            remarks: p.remarks ?? null,
            status: p.status || 'GOOD',
            createdAt: p.createdAt ?? p.created_at ?? new Date().toISOString()
        })).filter(p => p.id && p.orNumber && p.date);
        const restoreRemarks = (loan.remarks || []).map(r => ({
            id: r.id,
            text: r.text,
            collector: r.collector ?? loan.collector,
            timestamp: r.timestamp ?? new Date().toISOString(),
            ptpDate: r.ptpDate ?? r.ptp_date ?? null,
            followUpDate: r.followUpDate ?? r.follow_up_date ?? null
        })).filter(r => r.id && r.text);
        const restoreHistory = (loan.history || []).map(h => ({
            id: h.id,
            type: h.type || 'Activity',
            description: h.description,
            user: h.user ?? h.user_name ?? 'System',
            role: h.role ?? h.user_role ?? 'System',
            module: h.module || 'Administration',
            timestamp: h.timestamp ?? new Date().toISOString()
        })).filter(h => h.id && h.description);

        await client.query(
            'INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage, date_release, principal, total_loan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)',
            [loan.id, loan.collector, loan.code, loan.firstName, loan.lastName, loan.borrowerName, loan.monthReported, loan.dueDate, loan.outstandingBalance, loan.amountCollected, loan.runningBalance, loan.status, loan.location, loan.area, loan.city, loan.barangay, loan.fullAddress, loan.contactNumber ?? null, loan.branch, loan.aiPriority ?? null, loan.promiseToPayDate ?? null, loan.followUpDate ?? null, scheduleVal, loan.actionNote ?? null, loan.actionStage ?? null, loan.dateRelease ?? null, loan.principal ?? null, loan.totalLoan ?? null]
        );

        if (restorePayments.length > 0) {
            for (const p of restorePayments) {
                await client.query(`
                    INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
                    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM payments
                        WHERE id = $1 OR or_number = $4 OR (loan_id = $2 AND date = $5)
                    )
                `, [p.id, p.loanId, p.amount, p.orNumber, p.date, p.balanceAfter, p.recorder, p.remarks, p.status, p.createdAt]);
            }
        }

        if (restoreRemarks.length > 0) {
            for (const r of restoreRemarks) {
                await client.query(`
                    INSERT INTO remarks (id, loan_id, text, collector, timestamp, ptp_date, follow_up_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT DO NOTHING
                `, [r.id, loan.id, r.text, r.collector, r.timestamp, r.ptpDate, r.followUpDate]);
            }
        }

        if (restoreHistory.length > 0) {
            for (const h of restoreHistory) {
                await client.query(`
                    INSERT INTO activity_logs (id, loan_id, type, description, user_name, user_role, module, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT DO NOTHING
                `, [h.id, loan.id, h.type, h.description, h.user, h.role, h.module, h.timestamp]);
            }
        }

        await client.query('DELETE FROM deleted_loans WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ success: true, loan });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/recycle_bin/:id', async (req, res) => {
    try {
        await query('DELETE FROM deleted_loans WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payments
app.get('/api/payments', async (req, res) => {
    try {
        const result = await query('SELECT * FROM payments');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments', async (req, res) => {
    const { id, loanId, amount, orNumber, date, balanceAfter, recorder, remarks, status, createdAt } = req.body;
    try {
        // Upsert: if a GOOD payment already exists for this loan on this date, replace it.
        // This prevents duplicate payment dates in the Payment Stream.
        await query(`
            INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (loan_id, date) DO UPDATE SET
                id           = EXCLUDED.id,
                amount       = EXCLUDED.amount,
                or_number    = EXCLUDED.or_number,
                balance_after= EXCLUDED.balance_after,
                recorder     = EXCLUDED.recorder,
                remarks      = EXCLUDED.remarks,
                status       = EXCLUDED.status,
                created_at   = EXCLUDED.created_at
        `, [id, loanId, amount, orNumber, date, balanceAfter, recorder, remarks, status, createdAt]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/payments/:orNumber', async (req, res) => {
    const { orNumber } = req.params;
    const { status, remarks } = req.body;
    try {
        await query('UPDATE payments SET status=$1, remarks=$2 WHERE or_number=$3', [status, remarks, orNumber]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Collectors
app.get('/api/collectors', async (req, res) => {
    try {
        const result = await query('SELECT * FROM collectors');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/collectors', async (req, res) => {
    const { id, name, nickname, address, assignedSupervisor, photoUrl, branch } = req.body;
    try {
        await assertCollectorIsUnique({ name, nickname });
        const savedPhotoUrl = persistCollectorPhoto(id, photoUrl);
        await query('INSERT INTO collectors (id, name, nickname, address, assigned_supervisor, photo_url, branch) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, name, nickname, address, assignedSupervisor, savedPhotoUrl, branch]);
        res.json({ success: true });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.put('/api/collectors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, nickname, address, assignedSupervisor, photoUrl, branch } = req.body;
    try {
        await assertCollectorIsUnique({ name, nickname }, id);
        const savedPhotoUrl = persistCollectorPhoto(id, photoUrl);
        await query('UPDATE collectors SET name=$1, nickname=$2, address=$3, assigned_supervisor=$4, photo_url=$5, branch=$6 WHERE id=$7', [name, nickname, address, assignedSupervisor, savedPhotoUrl, branch, id]);
        res.json({ success: true });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.delete('/api/collectors/:id', async (req, res) => {
    try {
        await query('DELETE FROM collectors WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Remarks
app.get('/api/remarks', async (req, res) => {
    try {
        const result = await query('SELECT * FROM remarks');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/remarks', async (req, res) => {
    const { id, loanId, text, collector, timestamp, ptpDate, followUpDate } = req.body;
    try {
        await query('INSERT INTO remarks (id, loan_id, text, collector, timestamp, ptp_date, follow_up_date) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, loanId, text, collector, timestamp, ptpDate, followUpDate]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/remarks/:id', async (req, res) => {
    const { id } = req.params;
    const { text, collector, ptpDate, followUpDate } = req.body;
    try {
        await query(
            'UPDATE remarks SET text=$1, collector=COALESCE($2, collector), ptp_date=$3, follow_up_date=$4 WHERE id=$5',
            [text, collector ?? null, ptpDate, followUpDate, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/remarks/:id', async (req, res) => {
    try {
        await query('DELETE FROM remarks WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Demand Letters
app.get('/api/demand_letters', async (req, res) => {
    try {
        const result = await query('SELECT * FROM demand_letters');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/demand_letters', async (req, res) => {
    const { id, loanId, collectorName, borrowerName, type, datePrepared, dateReceived, followUpDate, status, remarks, branch, courrier } = req.body;
    try {
        await query(
            'INSERT INTO demand_letters (id, loan_id, collector_name, borrower_name, type, date_prepared, date_received, follow_up_date, status, remarks, branch, courrier) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
            [id, loanId, collectorName, borrowerName, type, datePrepared, dateReceived, followUpDate, status, remarks, branch, courrier]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/demand_letters/:id', async (req, res) => {
    const { id } = req.params;
    const { collectorName, type, datePrepared, dateReceived, followUpDate, status, remarks, courrier } = req.body;
    try {
        await query(
            'UPDATE demand_letters SET collector_name=COALESCE($1, collector_name), type=$2, date_prepared=$3, date_received=$4, follow_up_date=$5, status=$6, remarks=$7, courrier=$8 WHERE id=$9',
            [collectorName ?? null, type, datePrepared, dateReceived, followUpDate, status, remarks, courrier, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activity Logs
app.get('/api/activity_logs', async (req, res) => {
    try {
        const result = await query('SELECT * FROM activity_logs');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/activity_logs', async (req, res) => {
    const { id, loan_id, type, description, user_name, user_role, module, timestamp } = req.body;
    try {
        await query(
            'INSERT INTO activity_logs (id, loan_id, type, description, user_name, user_role, module, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, loan_id, type, description, user_name, user_role, module, timestamp]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Visit Logs (Close Monitoring)
app.get('/api/visit_logs', async (req, res) => {
    try {
        const result = await query('SELECT * FROM visit_logs ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/visit_logs/:loanId', async (req, res) => {
    try {
        const result = await query('SELECT * FROM visit_logs WHERE loan_id = $1 ORDER BY timestamp DESC', [req.params.loanId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/visit_logs', async (req, res) => {
    const { id, loanId, visitDate, collectorNotes, clientComment, visitedByCollector, action, loggedBy, timestamp } = req.body;
    try {
        await query(
            'INSERT INTO visit_logs (id, loan_id, visit_date, collector_notes, client_comment, visited_by_collector, action, logged_by, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, loanId, visitDate, collectorNotes, clientComment, visitedByCollector, action, loggedBy, timestamp]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/visit_logs/:id', async (req, res) => {
    try {
        await query('DELETE FROM visit_logs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Contact Logs (Action Tracker - Visit/Contact Log)
app.get('/api/contact_logs', async (req, res) => {
    try {
        const result = await query('SELECT * FROM contact_logs ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/contact_logs/:loanId', async (req, res) => {
    try {
        const result = await query('SELECT * FROM contact_logs WHERE loan_id = $1 ORDER BY timestamp DESC', [req.params.loanId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contact_logs', async (req, res) => {
    const { id, loanId, contactDate, method, notes, clientResponse, hasResponse, loggedBy, timestamp } = req.body;
    try {
        await query(
            'INSERT INTO contact_logs (id, loan_id, contact_date, method, notes, client_response, has_response, logged_by, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, loanId, contactDate, method, notes, clientResponse, hasResponse, loggedBy, timestamp]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/contact_logs/:id', async (req, res) => {
    try {
        await query('DELETE FROM contact_logs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Management Dispositions
app.get('/api/management_dispositions', async (req, res) => {
    try {
        const result = await query('SELECT * FROM management_dispositions ORDER BY decision_date DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/management_dispositions/:loanId', async (req, res) => {
    try {
        const result = await query('SELECT * FROM management_dispositions WHERE loan_id = $1 ORDER BY decision_date DESC', [req.params.loanId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/management_dispositions', async (req, res) => {
    const { id, loanId, type, reason, evidence, status, decidedBy, decisionDate } = req.body;
    try {
        await query(
            'INSERT INTO management_dispositions (id, loan_id, type, reason, evidence, status, decided_by, decision_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, loanId, type, reason, JSON.stringify(evidence || []), status, decidedBy, decisionDate]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/management_dispositions/:id/status', async (req, res) => {
    const { status, role } = req.body;
    if (status === 'Approved' && role !== 'EXECUTIVE_VICE_PRESIDENT') {
        return res.status(403).json({ error: 'Sorry! Only the Executive Vice President can Approve Clients' });
    }

    try {
        await query(
            'UPDATE management_dispositions SET status = $1 WHERE id = $2',
            [status, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// JCASH read-only migration batches
app.get('/api/migration_batches', async (req, res) => {
    try {
        await ensureMigrationTables();
        const result = await query(`
            SELECT id, cycle_start, cycle_end, status, detected_count, payment_count,
                   payload, source_path, detected_at, migrated_at, migrated_by, error
            FROM migration_batches
            WHERE status = 'PENDING'
            ORDER BY cycle_start ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/migration_batches/scan', async (req, res) => {
    try {
        await ensureMigrationTables();
        const { maturityFrom, maturityTo } = req.body || {};
        const rangeFrom = maturityFrom;
        const rangeTo = maturityTo;
        const hasSelectedRange = Boolean(rangeFrom && rangeTo);
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!hasSelectedRange || !datePattern.test(rangeFrom) || !datePattern.test(rangeTo) || rangeFrom > rangeTo) {
            return res.status(400).json({ error: 'Valid Maturity Date From and To dates are required.' });
        }

        const cycles = [{ start: rangeFrom, end: rangeTo }];
        if (cycles.length === 0) return res.json({ success: true, batches: [] });

        const existing = await query('SELECT cycle_start, cycle_end, status FROM migration_batches');
        const openKeys = new Set(existing.rows.filter(row => row.status === 'MIGRATED').map(row => `${row.cycle_start}|${row.cycle_end}`));
        const cyclesToScan = hasSelectedRange ? cycles : cycles.filter(cycle => !openKeys.has(`${cycle.start}|${cycle.end}`));

        if (cyclesToScan.length === 0) {
            const pending = await query("SELECT * FROM migration_batches WHERE status = 'PENDING' ORDER BY cycle_start ASC");
            return res.json({ success: true, batches: pending.rows });
        }

        for (const cycle of cyclesToScan) {
            const snapshot = await readJcashCycleSnapshot(cycle.start, cycle.end);

            // Build a lookup map from tblCustomer keyed by Code
            const customerMap = new Map();
            for (const cust of snapshot.customers) {
                const custCode = String(pick(cust, ['Code'], '')).trim();
                if (custCode) {
                    customerMap.set(custCode, {
                        address: String(pick(cust, ['Address'], '')).trim(),
                        phoneNumber: String(pick(cust, ['PhoneNumber', 'Phone', 'Cellphone'], '')).trim()
                    });
                }
            }

            const mappedLoans = snapshot.loans
                .filter(isGoodSourceLoan)
                .map(loan => {
                    const mapped = mapSourceLoan(loan);
                    // Enrich with tblCustomer data
                    const custData = customerMap.get(mapped.loan.code);
                    if (custData) {
                        if (custData.address) mapped.loan.fullAddress = custData.address;
                        if (custData.phoneNumber) mapped.loan.contactNumber = custData.phoneNumber;
                    }
                    return mapped;
                })
                .filter(item => item.sourceLoanId && item.loan.dueDate);

            const accounts = mappedLoans
                .filter(item => item.loan.dueDate >= cycle.start && item.loan.dueDate <= cycle.end)
                .map(item => {
                    const sourceLoanIdText = String(item.sourceLoanId).trim();
                    const sourceLoanIdNumber = Number(sourceLoanIdText);
                    const sourcePayments = sortSourcePayments(snapshot.payments
                        .filter(payment => {
                            const paymentLoanIdText = String(pick(payment, ['LoanID', 'loan_id'])).trim();
                            return paymentLoanIdText === sourceLoanIdText ||
                                (Number.isFinite(sourceLoanIdNumber) && Number(paymentLoanIdText) === sourceLoanIdNumber);
                        })
                        .filter(isGoodSourcePayment));
                    const payments = sourcePayments
                        .map(payment => mapSourcePayment(payment, item.loan.id))
                        .filter(Boolean);

                    const latestSourceBalance = sourcePayments.length > 0
                        ? parseNumber(pick(sourcePayments[sourcePayments.length - 1], ['NewBalance', 'BalanceAfter', 'Balance', 'RunningBalance']))
                        : null;
                    const latestPaymentBalance = latestSourceBalance !== null ? latestSourceBalance :
                        (payments.length > 0 ? Number(payments[payments.length - 1].balanceAfter) : null);
                    item.loan.amountCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                    if (payments.length === 0) {
                        item.loan.runningBalance = Math.max(Number(item.loan.totalLoan || 0), Number(item.loan.outstandingBalance || 0));
                        item.loan.status = item.loan.runningBalance > 0 ? 'NMSR' : 'Paid';
                    } else if (latestPaymentBalance !== null && Number.isFinite(latestPaymentBalance)) {
                        item.loan.runningBalance = Math.max(0, latestPaymentBalance);
                        item.loan.status = latestPaymentBalance <= 0 ? 'Paid' : 'M';
                    }
                    // JCASH tblLoan.Total is the authoritative loan total. Do
                    // not inflate it from existing/payment-derived balances.
                    if (!Number.isFinite(Number(item.loan.totalLoan)) || Number(item.loan.totalLoan) <= 0) {
                        item.loan.totalLoan = inferOriginalTotalLoan(item.loan, payments);
                    }

                    return {
                        sourceLoanId: item.sourceLoanId,
                        sourceCode: item.loan.code,
                        loan: item.loan,
                        payments
                    };
                });

            const payload = {
                sourcePath: JCASHDB_PATH,
                cycleStart: cycle.start,
                cycleEnd: cycle.end,
                accounts
            };
            const paymentCount = accounts.reduce((sum, account) => sum + account.payments.length, 0);
            const batchId = `jcash-${cycle.start}-${cycle.end}`;

            await query(`
                INSERT INTO migration_batches
                    (id, cycle_start, cycle_end, status, detected_count, payment_count, payload, source_path)
                VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7)
                ON CONFLICT (cycle_start, cycle_end) DO UPDATE SET
                    status = 'PENDING',
                    detected_count = EXCLUDED.detected_count,
                    payment_count = EXCLUDED.payment_count,
                    payload = EXCLUDED.payload,
                    source_path = EXCLUDED.source_path,
                    detected_at = CURRENT_TIMESTAMP,
                    error = NULL
            `, [batchId, cycle.start, cycle.end, accounts.length, paymentCount, JSON.stringify(payload), JCASHDB_PATH]);
        }

        const pending = await query("SELECT * FROM migration_batches WHERE status = 'PENDING' ORDER BY cycle_start ASC");
        res.json({ success: true, batches: pending.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/migration_batches/:id/account', async (req, res) => {
    const { id } = req.params;
    const { code, updatedLoanData } = req.body || {};
    if (!code || !updatedLoanData) return res.status(400).json({ error: 'Account code and updated loan data are required.' });

    try {
        const result = await query("SELECT payload FROM migration_batches WHERE id = $1 AND status = 'PENDING'", [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pending migration batch not found.' });

        const payload = typeof result.rows[0].payload === 'string' ? JSON.parse(result.rows[0].payload) : result.rows[0].payload;
        const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        const accountIndex = accounts.findIndex(account => account.loan?.code === code || account.sourceCode === code);
        if (accountIndex === -1) return res.status(404).json({ error: 'Migration account not found.' });

        accounts[accountIndex] = {
            ...accounts[accountIndex],
            loan: { ...accounts[accountIndex].loan, ...updatedLoanData },
            isEdited: true
        };
        payload.accounts = accounts;

        const paymentCount = accounts.reduce((sum, account) => sum + (account.payments?.length || 0), 0);
        await query(
            'UPDATE migration_batches SET payload = $2, detected_count = $3, payment_count = $4 WHERE id = $1',
            [id, JSON.stringify(payload), accounts.length, paymentCount]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/migration_batches/:id/account/:code', async (req, res) => {
    const { id, code } = req.params;
    const { deletedBy, reason } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT payload FROM migration_batches WHERE id = $1 AND status = 'PENDING'", [id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending migration batch not found.' });
        }

        const payload = typeof result.rows[0].payload === 'string' ? JSON.parse(result.rows[0].payload) : result.rows[0].payload;
        const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        const account = accounts.find(item => item.loan?.code === code || item.sourceCode === code);
        if (!account) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Migration account not found.' });
        }

        payload.accounts = accounts.filter(item => item !== account);
        const paymentCount = payload.accounts.reduce((sum, item) => sum + (item.payments?.length || 0), 0);

        await client.query(
            'UPDATE migration_batches SET payload = $2, detected_count = $3, payment_count = $4 WHERE id = $1',
            [id, JSON.stringify(payload), payload.accounts.length, paymentCount]
        );
        await client.query(
            'INSERT INTO deleted_loans (id, original_loan_data, deleted_by, reason, branch) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET original_loan_data = EXCLUDED.original_loan_data, deleted_by = EXCLUDED.deleted_by, reason = EXCLUDED.reason, branch = EXCLUDED.branch, deleted_at = CURRENT_TIMESTAMP',
            [account.loan.id, JSON.stringify(account.loan), deletedBy || 'System', reason || 'Excluded from JCASH Migration', account.loan.branch]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/migration_batches/:id/migrate', async (req, res) => {
    const { id } = req.params;
    const { user, selectedAccountKeys } = req.body || {};
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query("SELECT * FROM migration_batches WHERE id = $1 AND status = 'PENDING'", [id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Pending migration batch not found.' });
        }

        const batch = result.rows[0];
        const payload = typeof batch.payload === 'string' ? JSON.parse(batch.payload) : batch.payload;
        const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        const selectedKeySet = Array.isArray(selectedAccountKeys) && selectedAccountKeys.length > 0
            ? new Set(selectedAccountKeys.map(key => String(key).trim()).filter(Boolean))
            : null;
        const getAccountMigrationKeys = (account) => [
            account?.sourceLoanId,
            account?.sourceCode,
            account?.loan?.id,
            account?.loan?.code
        ].map(key => String(key || '').trim()).filter(Boolean);
        const accountsToMigrate = selectedKeySet
            ? accounts.filter(account => getAccountMigrationKeys(account).some(key => selectedKeySet.has(key)))
            : accounts;

        if (accountsToMigrate.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Select at least one migration account.' });
        }

        for (const account of accountsToMigrate) {
            const loan = account.loan;
            const scheduleVal = loan.recurringSchedule ? (typeof loan.recurringSchedule === 'string' ? loan.recurringSchedule : JSON.stringify(loan.recurringSchedule)) : null;
            await client.query(`
                INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage, date_release, principal, total_loan)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
                ON CONFLICT (id) DO UPDATE SET
                    code = EXCLUDED.code,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    borrower_name = EXCLUDED.borrower_name,
                    due_date = EXCLUDED.due_date,
                    amount_collected = EXCLUDED.amount_collected,
                    running_balance = EXCLUDED.running_balance,
                    status = EXCLUDED.status,
                    collector = CASE
                        WHEN loans.collector IS NULL OR TRIM(loans.collector) = '' OR loans.collector ~ '^[0-9,.]+$' THEN EXCLUDED.collector
                        ELSE loans.collector
                    END,
                    location = COALESCE(NULLIF(TRIM(loans.location), ''), EXCLUDED.location),
                    area = COALESCE(NULLIF(NULLIF(TRIM(loans.area), ''), 'N/A'), EXCLUDED.area),
                    city = COALESCE(NULLIF(NULLIF(TRIM(loans.city), ''), 'N/A'), EXCLUDED.city),
                    barangay = COALESCE(NULLIF(NULLIF(TRIM(loans.barangay), ''), 'N/A'), EXCLUDED.barangay),
                    full_address = COALESCE(NULLIF(TRIM(loans.full_address), ''), EXCLUDED.full_address),
                    contact_number = COALESCE(NULLIF(TRIM(loans.contact_number), ''), EXCLUDED.contact_number),
                    branch = EXCLUDED.branch,
                    ai_priority = COALESCE(NULLIF(TRIM(loans.ai_priority), ''), EXCLUDED.ai_priority),
                    promise_to_pay_date = COALESCE(NULLIF(TRIM(loans.promise_to_pay_date), ''), EXCLUDED.promise_to_pay_date),
                    follow_up_date = COALESCE(NULLIF(TRIM(loans.follow_up_date), ''), EXCLUDED.follow_up_date),
                    recurring_schedule = COALESCE(loans.recurring_schedule, EXCLUDED.recurring_schedule),
                    action_note = COALESCE(NULLIF(TRIM(loans.action_note), ''), EXCLUDED.action_note),
                    action_stage = COALESCE(NULLIF(TRIM(loans.action_stage), ''), EXCLUDED.action_stage),
                    date_release = EXCLUDED.date_release,
                    principal = EXCLUDED.principal,
                    total_loan = EXCLUDED.total_loan
            `, [
                loan.id, loan.collector, loan.code, loan.firstName, loan.lastName, loan.borrowerName,
                loan.monthReported, loan.dueDate, loan.outstandingBalance, loan.amountCollected,
                loan.runningBalance, loan.status, loan.location, loan.area, loan.city, loan.barangay,
                loan.fullAddress, loan.contactNumber ?? null, loan.branch, loan.aiPriority ?? null,
                loan.promiseToPayDate ?? null, loan.followUpDate ?? null, scheduleVal,
                loan.actionNote ?? null, loan.actionStage ?? null, loan.dateRelease ?? null,
                loan.principal ?? null, loan.totalLoan ?? null
            ]);

            await client.query(
                "DELETE FROM payments WHERE loan_id = $1 AND remarks = 'Migrated from jcashdb.mdb'",
                [loan.id]
            );

            for (const payment of account.payments || []) {
                await client.query(`
                    INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, remarks, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (loan_id, date) DO UPDATE SET
                        id = EXCLUDED.id,
                        amount = EXCLUDED.amount,
                        or_number = EXCLUDED.or_number,
                        balance_after = EXCLUDED.balance_after,
                        recorder = EXCLUDED.recorder,
                        remarks = EXCLUDED.remarks,
                        status = EXCLUDED.status,
                        created_at = EXCLUDED.created_at
                `, [
                    payment.id, payment.loanId, payment.amount, payment.orNumber, payment.date,
                    payment.balanceAfter, payment.recorder, payment.remarks, payment.status, payment.createdAt
                ]);
            }
        }

        const migratedKeySet = new Set(accountsToMigrate.flatMap(getAccountMigrationKeys));
        const remainingAccounts = accounts.filter(account => !getAccountMigrationKeys(account).some(key => migratedKeySet.has(key)));
        const migratedPaymentCount = accountsToMigrate.reduce((sum, account) => sum + (account.payments?.length || 0), 0);

        if (remainingAccounts.length === 0) {
            await client.query(
                "UPDATE migration_batches SET status = 'MIGRATED', detected_count = 0, payment_count = 0, migrated_at = CURRENT_TIMESTAMP, migrated_by = $2, error = NULL WHERE id = $1",
                [id, user || 'System']
            );
        } else {
            payload.accounts = remainingAccounts;
            const remainingPaymentCount = remainingAccounts.reduce((sum, account) => sum + (account.payments?.length || 0), 0);
            await client.query(
                "UPDATE migration_batches SET status = 'PENDING', detected_count = $2, payment_count = $3, payload = $4, migrated_at = CURRENT_TIMESTAMP, migrated_by = $5, error = NULL WHERE id = $1",
                [id, remainingAccounts.length, remainingPaymentCount, JSON.stringify(payload), user || 'System']
            );
        }

        await client.query('COMMIT');
        res.json({
            success: true,
            importedCount: accountsToMigrate.length,
            paymentCount: migratedPaymentCount,
            remainingCount: remainingAccounts.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        try {
            await query('UPDATE migration_batches SET status = $2, error = $3 WHERE id = $1', [id, 'ERROR', err.message]);
        } catch (_) {}
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bridge Server running on http://0.0.0.0:${PORT}`);
    console.log(`Network access: http://192.168.254.115:${PORT}`);
});
