/**
 * final_fix_4_clients.cjs
 * Deletes all payments for the 4 clients and cleanly re-imports them from the CSV
 * using the correct local date parsing to avoid timezone delays.
 */
const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

const TARGETS = [
    { realId: '2axtq0b', csvLoanId: '42356', code: '1064', name: 'Alvarez' },
    { realId: '6ubw174', csvLoanId: '8239',  code: '1254', name: 'Manatad' },
    { realId: '8zyvd36', csvLoanId: '16245', code: '957',  name: 'Nayga' },
    { realId: 'a9v9wfq', csvLoanId: '11051', code: '1423', name: 'Velarde' }
];

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();
    console.log('Connected to DB.');

    // ── 1. DELETE EXISTING PAYMENTS FOR THE 4 CLIENTS ───────────────────────
    for (const target of TARGETS) {
        const delRes = await client.query(`DELETE FROM payments WHERE loan_id = $1`, [target.realId]);
        console.log(`Deleted ${delRes.rowCount} existing payments for ${target.name} (realId: ${target.realId})`);
    }

    // ── 2. HELPERS ──────────────────────────────────────────────────────────
    const parseCSVLine = (text) => {
        const re = /"([^"]*)"|([^,]+)|,/g;
        let arr = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            if (m[0] === ',') {
                if (re.lastIndex === m.index + 1) arr.push('');
            } else {
                arr.push(m[1] !== undefined ? m[1] : m[2]);
            }
        }
        return arr;
    };

    // Correct local date parsing (avoids UTC timezone shift)
    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Build a map of csvLoanId -> realId
    const csvToRealMap = {};
    TARGETS.forEach(t => csvToRealMap[t.csvLoanId] = t.realId);

    // ── 3. STREAM AND IMPORT ────────────────────────────────────────────────
    console.log('\nReading payments.csv...');
    const stream = fs.createReadStream('payments.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];
    let inserted = 0;

    for await (const line of rl) {
        if (isHeader) {
            headers = parseCSVLine(line);
            isHeader = false;
            continue;
        }

        const values = parseCSVLine(line);
        const payment = {};
        headers.forEach((h, i) => payment[h] = values[i]);

        const realId = csvToRealMap[payment.LoanID];
        if (!realId) continue; // Only process our 4 targets
        if (!payment.ID) continue;

        const paymentDate = formatDate(payment.Date);
        if (!paymentDate) continue;

        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        const newId = `${payment.ID}-${realId}`;
        const orNumber = `OR-${payment.ID}`; // keep it simple, just OR-116498

        try {
            await client.query(`
                INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (loan_id, date) DO UPDATE SET
                    amount = EXCLUDED.amount,
                    or_number = EXCLUDED.or_number,
                    balance_after = EXCLUDED.balance_after,
                    recorder = EXCLUDED.recorder,
                    status = EXCLUDED.status
            `, [newId, realId, amount, orNumber, paymentDate, balanceAfter, payment.User || 'System', 'GOOD']);
            inserted++;
        } catch (err) {
            // If duplicate OR number constraint hits (because OR is unique globally), append realId to OR number
            try {
                await client.query(`
                    INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT (loan_id, date) DO UPDATE SET
                        amount = EXCLUDED.amount,
                        or_number = EXCLUDED.or_number,
                        balance_after = EXCLUDED.balance_after,
                        recorder = EXCLUDED.recorder,
                        status = EXCLUDED.status
                `, [newId, realId, amount, `${orNumber}-${realId}`, paymentDate, balanceAfter, payment.User || 'System', 'GOOD']);
                inserted++;
            } catch (err2) {
                console.error(`  ERROR inserting payment ${payment.ID} for ${realId}: ${err2.message}`);
            }
        }
    }

    console.log(`\nImported ${inserted} payments successfully.`);

    // ── 4. VERIFY ───────────────────────────────────────────────────────────
    console.log('\n=== Final Counts ===');
    for (const target of TARGETS) {
        const c = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = $1`, [target.realId]);
        console.log(`${target.name}: ${c.rows[0].count} payments`);
    }

    await client.end();
    console.log('\nDone.');
}

run().catch(console.error);
