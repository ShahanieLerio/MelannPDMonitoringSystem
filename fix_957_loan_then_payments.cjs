/**
 * fix_957_loan_then_payments.cjs
 * 1. Inserts the loan record for Code 957 (LoanID 16245) if missing
 * 2. Then inserts all its payments from CSV
 */
const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();
    console.log('Connected.');

    // ── Check if loan 16245 exists ──────────────────────────────────────────
    const loanCheck = await client.query(`SELECT id, code, borrower_name FROM loans WHERE id = $1`, ['16245']);
    if (loanCheck.rows.length > 0) {
        console.log('Loan 16245 already exists:', loanCheck.rows[0]);
    } else {
        console.log('Loan 16245 NOT found. Inserting from loans.csv data...');

        // Data from loans.csv line 306:
        // "16245","RENATO PAST DUE","957","NAYGA","ROSELA","8/5/2020 ...","17000","18530","8/6/2020","9/20/2020"
        // BranchID="DOMINGONO", TotalPayment=6820, Balance=11710
        await client.query(`
            INSERT INTO loans (
                id, collector, code, first_name, last_name, borrower_name,
                month_reported, due_date, outstanding_balance, amount_collected,
                running_balance, status, location, area, city, barangay, branch
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
            ON CONFLICT (id) DO UPDATE SET
                collector        = EXCLUDED.collector,
                code             = EXCLUDED.code,
                borrower_name    = EXCLUDED.borrower_name,
                month_reported   = EXCLUDED.month_reported,
                due_date         = EXCLUDED.due_date,
                outstanding_balance = EXCLUDED.outstanding_balance,
                amount_collected = EXCLUDED.amount_collected,
                running_balance  = EXCLUDED.running_balance
        `, [
            '16245',              // id
            'RENATO PAST DUE',    // collector
            '957',                // code
            'ROSELA',             // first_name
            'NAYGA',              // last_name
            'ROSELA NAYGA',       // borrower_name
            '2020-09',            // month_reported
            '2020-09-20',         // due_date
            18530,                // outstanding_balance (Total)
            6820,                 // amount_collected (TotalPayment)
            11710,                // running_balance (Balance)
            'NM',                 // status
            'NL',                 // location
            'PD BAYBAY',          // area
            'Baybay',             // city
            'Hilapritan',         // barangay
            'DOMINGONO',          // branch
        ]);
        console.log('  ✓ Loan 16245 inserted.');
    }

    // ── Parse CSV helpers ───────────────────────────────────────────────────
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

    // ── Insert payments for LoanID 16245 ────────────────────────────────────
    console.log('\nReading payments.csv for LoanID 16245...');
    const stream = fs.createReadStream('payments.csv');
    const rl = readline.createInterface({ input: stream });
    let isHeader = true;
    let headers = [];
    let inserted = 0;
    let updated = 0;
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

        if (payment.LoanID !== '16245') continue;
        if (!payment.ID) continue;

        const paymentDate = formatDate(payment.Date);
        if (!paymentDate) continue;

        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        const orNumber = `OR-${payment.ID}-L${payment.LoanID}`;
        const compositeId = `${payment.ID}-L${payment.LoanID}`;

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
            `, [compositeId, '16245', amount, orNumber, paymentDate, balanceAfter, payment.User || 'System', 'GOOD']);

            if (result.rows[0]?.inserted) inserted++;
            else updated++;
        } catch (err) {
            console.error(`  ERROR: ID=${payment.ID} date=${paymentDate} => ${err.message}`);
            errors++;
        }
    }

    const finalCount = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = '16245'`);
    console.log('\n=== Result ===');
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Updated  : ${updated}`);
    console.log(`  Errors   : ${errors}`);
    console.log(`  Total payments for Code 957 in DB: ${finalCount.rows[0].count}`);

    await client.end();
    console.log('\nDone.');
}

run().catch(console.error);
