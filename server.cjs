
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

// Generic Query Handler
const query = (text, params) => pool.query(text, params);

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
    const { id, username, fullName, role, status, branch, createdAt, createdBy, statusHistory } = req.body;
    try {
        await query(
            'INSERT INTO users (id, username, full_name, role, status, branch, created_at, created_by, status_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [id, username, fullName, role, status, branch, createdAt, createdBy, JSON.stringify(statusHistory)]
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

// Loans
app.get('/api/loans', async (req, res) => {
    try {
        const result = await query('SELECT * FROM loans ORDER BY last_name ASC, first_name ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/loans/bulk', async (req, res) => {
    const loans = req.body;
    if (!Array.isArray(loans)) return res.status(400).json({ error: 'Payload must be an array' });

    console.log(`Starting bulk import of ${loans.length} records...`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const loan of loans) {
            const { id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage } = loan;
            try {
                const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
                await client.query(
                    'INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)',
                    [id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, scheduleVal, actionNote ?? null, actionStage ?? null]
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
    const { id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage } = req.body;
    try {
        const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
        await query(
            'INSERT INTO loans (id, collector, code, first_name, last_name, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, status, location, area, city, barangay, full_address, contact_number, branch, ai_priority, promise_to_pay_date, follow_up_date, recurring_schedule, action_note, action_stage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)',
            [id, collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, scheduleVal, actionNote ?? null, actionStage ?? null]
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
    const { collector, code, firstName, lastName, borrowerName, monthReported, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber, branch, aiPriority, promiseToPayDate, followUpDate, recurringSchedule, actionNote, actionStage } = req.body;
    try {
        const scheduleVal = recurringSchedule ? (typeof recurringSchedule === 'string' ? recurringSchedule : JSON.stringify(recurringSchedule)) : null;
        await query(
            'UPDATE loans SET collector=$1, first_name=$2, last_name=$3, borrower_name=$4, due_date=$5, outstanding_balance=$6, amount_collected=$7, running_balance=$8, status=$9, location=$10, area=$11, city=$12, barangay=$13, full_address=$14, contact_number=$15, branch=$16, ai_priority=$17, promise_to_pay_date=$18, follow_up_date=$19, month_reported=$20, recurring_schedule=$21, code=$23, action_note=$24, action_stage=$25 WHERE id=$22',
            [collector, firstName, lastName, borrowerName, dueDate, outstandingBalance, amountCollected, runningBalance, status, location, area, city, barangay, fullAddress, contactNumber ?? null, branch, aiPriority ?? null, promiseToPayDate ?? null, followUpDate ?? null, monthReported ?? null, scheduleVal, id, code ?? null, actionNote ?? null, actionStage ?? null]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/loans/:id', async (req, res) => {
    try {
        await query('DELETE FROM loans WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    const { id, name, nickname, address, photoUrl, branch } = req.body;
    try {
        await assertCollectorIsUnique({ name, nickname });
        const savedPhotoUrl = persistCollectorPhoto(id, photoUrl);
        await query('INSERT INTO collectors (id, name, nickname, address, photo_url, branch) VALUES ($1, $2, $3, $4, $5, $6)', [id, name, nickname, address, savedPhotoUrl, branch]);
        res.json({ success: true });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.put('/api/collectors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, nickname, address, photoUrl, branch } = req.body;
    try {
        await assertCollectorIsUnique({ name, nickname }, id);
        const savedPhotoUrl = persistCollectorPhoto(id, photoUrl);
        await query('UPDATE collectors SET name=$1, nickname=$2, address=$3, photo_url=$4, branch=$5 WHERE id=$6', [name, nickname, address, savedPhotoUrl, branch, id]);
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
    const { text, ptpDate, followUpDate } = req.body;
    try {
        await query(
            'UPDATE remarks SET text=$1, ptp_date=$2, follow_up_date=$3 WHERE id=$4',
            [text, ptpDate, followUpDate, id]
        );
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
    const { id, loanId, collectorName, borrowerName, type, datePrepared, dateReceived, followUpDate, status, remarks, branch } = req.body;
    try {
        await query(
            'INSERT INTO demand_letters (id, loan_id, collector_name, borrower_name, type, date_prepared, date_received, follow_up_date, status, remarks, branch) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [id, loanId, collectorName, borrowerName, type, datePrepared, dateReceived, followUpDate, status, remarks, branch]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/demand_letters/:id', async (req, res) => {
    const { id } = req.params;
    const { type, datePrepared, dateReceived, followUpDate, status, remarks } = req.body;
    try {
        await query(
            'UPDATE demand_letters SET type=$1, date_prepared=$2, date_received=$3, follow_up_date=$4, status=$5, remarks=$6 WHERE id=$7',
            [type, datePrepared, dateReceived, followUpDate, status, remarks, id]
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Bridge Server running on http://localhost:${PORT}`);
});
