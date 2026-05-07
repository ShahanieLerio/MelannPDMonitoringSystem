/**
 * debug_957_payments.cjs
 * Diagnoses why Code 957 (LoanID 16245) payments are not inserting.
 */
const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

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

    const stream = fs.createReadStream('payments.csv');
    const rl = readline.createInterface({ input: stream });
    let isHeader = true;
    let headers = [];
    const rows = [];

    for await (const line of rl) {
        if (isHeader) {
            headers = parseCSVLine(line);
            isHeader = false;
            continue;
        }
        const values = parseCSVLine(line);
        const payment = {};
        headers.forEach((h, i) => payment[h] = values[i]);
        if (payment.LoanID === '16245') {
            rows.push(payment);
        }
    }

    console.log(`Found ${rows.length} rows in CSV for LoanID 16245`);

    for (const payment of rows) {
        const paymentDate = formatDate(payment.Date);
        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        const orNumber = `OR-${payment.ID}`;

        try {
            await client.query(`
                INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (loan_id, date) DO UPDATE SET
                    amount       = EXCLUDED.amount,
                    or_number    = EXCLUDED.or_number,
                    balance_after= EXCLUDED.balance_after,
                    recorder     = EXCLUDED.recorder,
                    status       = EXCLUDED.status
            `, [
                payment.ID,
                payment.LoanID,
                amount,
                orNumber,
                paymentDate,
                balanceAfter,
                payment.User || 'System',
                'GOOD'
            ]);
            console.log(`  OK: ID=${payment.ID} date=${paymentDate} amount=${amount}`);
        } catch (err) {
            console.error(`  FAIL: ID=${payment.ID} date=${paymentDate} amount=${amount} => ${err.message}`);
        }
    }

    const count = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = '16245'`);
    console.log(`\nFinal count in DB: ${count.rows[0].count}`);

    await client.end();
}

run().catch(console.error);
