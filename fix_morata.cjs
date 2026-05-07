const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();
    console.log('Connected to DB.');

    const morataRealId = 'x7hl2cj';
    const morataCsvId = '10368';

    // 1. Update Morata's loan details
    console.log('Updating Morata loan details...');
    await client.query(`
        UPDATE loans 
        SET outstanding_balance = $1, principal = $2, total_loan = $3, date_release = $4, due_date = $5, month_reported = $6
        WHERE id = $7
    `, [5450, 5000, 5450, '2019-04-25', '2019-06-09', '2019-06', morataRealId]);

    // 2. Delete wrong payments
    console.log('Deleting incorrect payments for Morata...');
    const delRes = await client.query('DELETE FROM payments WHERE loan_id = $1', [morataRealId]);
    console.log(`Deleted ${delRes.rowCount} wrong payments.`);

    // 3. Read payments from CSV
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
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    console.log('Reading payments.csv for Morata...');
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

        if (payment.LoanID !== morataCsvId) continue;
        if (!payment.ID) continue;

        const paymentDate = formatDate(payment.Date);
        if (!paymentDate) continue;

        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        const newId = `${payment.ID}-${morataRealId}`;
        const orNumber = `OR-${payment.ID}`;

        try {
            await client.query(`
                INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [newId, morataRealId, amount, orNumber, paymentDate, balanceAfter, payment.User || 'System', 'GOOD']);
            inserted++;
        } catch (err) {
            // fallback
            try {
                await client.query(`
                    INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                `, [newId, morataRealId, amount, `${orNumber}-${morataRealId}`, paymentDate, balanceAfter, payment.User || 'System', 'GOOD']);
                inserted++;
            } catch (err2) {
                console.error(`  ERROR inserting payment ${payment.ID}: ${err2.message}`);
            }
        }
    }
    console.log(`Imported ${inserted} correct payments for Morata.`);

    // 4. Recalculate status and running balance
    const payRes = await client.query('SELECT date, amount FROM payments WHERE loan_id = $1 ORDER BY date ASC', [morataRealId]);
    const payments = payRes.rows;

    let currentBalance = 5450;
    for (const p of payments) {
        currentBalance -= Number(p.amount);
    }
    const finalRunning = Math.max(0, currentBalance);

    let newStatus = '';
    if (finalRunning <= 0) {
        newStatus = 'Paid';
    } else if (payments.length === 0) {
        newStatus = 'NMSR';
    } else {
        const latestPayment = payments[payments.length - 1];
        const latestDate = new Date(latestPayment.date).getTime();
        const now = new Date().getTime();
        const msIn30Days = 30 * 24 * 60 * 60 * 1000;
        
        if (now - latestDate <= msIn30Days) {
            newStatus = 'M';
        } else {
            newStatus = 'NM';
        }
    }

    await client.query('UPDATE loans SET status = $1, running_balance = $2 WHERE id = $3', [newStatus, finalRunning, morataRealId]);
    console.log(`Morata updated: Running Balance = ${finalRunning}, Status = ${newStatus}`);

    await client.end();
}

run().catch(console.error);
