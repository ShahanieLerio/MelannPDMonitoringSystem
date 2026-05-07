/**
 * migrate_specific_payments.cjs
 * Migrates payments ONLY for client codes: 1064, 1254, 957, 1423
 * LoanID mapping:
 *   1064 -> 42356
 *   1254 -> 8239
 *    957 -> 16245
 *   1423 -> 11051
 *
 * Fix: OR numbers are generated as OR-<ID>-L<LoanID> to avoid unique constraint
 * collisions when the same payment ID was reused across loans in the legacy DB.
 */

const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

const TARGET_LOAN_IDS = new Set(['42356', '8239', '16245', '11051']);

const CODE_MAP = {
    '42356': '1064',
    '8239':  '1254',
    '16245': '957',
    '11051': '1423',
};

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });

    await client.connect();
    console.log('Connected to database.');

    // ── Show current state ──────────────────────────────────────────────────
    const before = await client.query(
        `SELECT loan_id, COUNT(*) AS cnt FROM payments WHERE loan_id = ANY($1) GROUP BY loan_id ORDER BY loan_id`,
        [Array.from(TARGET_LOAN_IDS)]
    );
    console.log('\n=== Payments in DB BEFORE migration ===');
    ['42356','8239','16245','11051'].forEach(lid => {
        const row = before.rows.find(r => r.loan_id === lid);
        console.log(`  Code ${CODE_MAP[lid]} (LoanID ${lid}): ${row ? row.cnt : 0} payments`);
    });

    // ── CSV helpers ─────────────────────────────────────────────────────────
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

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        return d.toISOString().split('T')[0];
    };

    // ── Stream payments.csv ──────────────────────────────────────────────────
    console.log('\nReading payments.csv...');
    const stream = fs.createReadStream('payments.csv');
    const rl = readline.createInterface({ input: stream });

    let isHeader = true;
    let headers = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for await (const line of rl) {
        if (isHeader) {
            headers = parseCSVLine(line);
            isHeader = false;
            continue;
        }

        const values = parseCSVLine(line);
        const payment = {};
        headers.forEach((h, i) => payment[h] = values[i]);

        if (!TARGET_LOAN_IDS.has(payment.LoanID)) continue;
        if (!payment.ID || !payment.LoanID) { skipped++; continue; }

        const paymentDate = formatDate(payment.Date);
        if (!paymentDate) { skipped++; continue; }

        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        // Unique OR number: OR-<ID>-L<LoanID> prevents collision with other loans
        const orNumber = `OR-${payment.ID}-L${payment.LoanID}`;

        try {
            const result = await client.query(`
                INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (loan_id, date) DO UPDATE SET
                    amount        = EXCLUDED.amount,
                    or_number     = EXCLUDED.or_number,
                    balance_after = EXCLUDED.balance_after,
                    recorder      = EXCLUDED.recorder,
                    status        = EXCLUDED.status
                RETURNING (xmax = 0) AS inserted
            `, [
                `${payment.ID}-L${payment.LoanID}`,  // composite id to avoid PK collision
                payment.LoanID,
                amount,
                orNumber,
                paymentDate,
                balanceAfter,
                payment.User || 'System',
                'GOOD'
            ]);
            if (result.rows[0]?.inserted) inserted++;
            else updated++;
        } catch (err) {
            console.error(`  ERROR: ID=${payment.ID} LoanID=${payment.LoanID} date=${paymentDate} => ${err.message}`);
            errors++;
        }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n=== Migration Complete ===');
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Updated  : ${updated}`);
    console.log(`  Skipped  : ${skipped}`);
    console.log(`  Errors   : ${errors}`);

    // ── Final verification ───────────────────────────────────────────────────
    const after = await client.query(
        `SELECT loan_id, COUNT(*) AS cnt FROM payments WHERE loan_id = ANY($1) GROUP BY loan_id ORDER BY loan_id`,
        [Array.from(TARGET_LOAN_IDS)]
    );
    console.log('\n=== Payments in DB AFTER migration ===');
    ['42356','8239','16245','11051'].forEach(lid => {
        const row = after.rows.find(r => r.loan_id === lid);
        console.log(`  Code ${CODE_MAP[lid]} (LoanID ${lid}): ${row ? row.cnt : 0} payments`);
    });

    await client.end();
    console.log('\nDone.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
