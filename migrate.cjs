const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });

    await client.connect();

    // Parse CSV line safely handling quotes
    const parseCSVLine = (text) => {
        const re = /"([^"]*)"|([^,]+)|,/g;
        let arr = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            if (m[0] === ',') {
                if (re.lastIndex === m.index + 1) { arr.push(''); }
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

    const formatMonth = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        return d.toISOString().slice(0, 7);
    };

    console.log('Reading loans.csv...');
    const loansStream = fs.createReadStream('loans.csv');
    const rlLoans = readline.createInterface({ input: loansStream });
    let isLoanHeader = true;
    let loanHeaders = [];
    let loansInserted = 0;

    for await (const line of rlLoans) {
        if (isLoanHeader) {
            loanHeaders = parseCSVLine(line);
            isLoanHeader = false;
            continue;
        }
        const values = parseCSVLine(line);
        const loan = {};
        loanHeaders.forEach((h, i) => loan[h] = values[i]);
        
        if (!loan.LoanID) continue;

        const maturityDate = formatDate(loan.Maturity) || '2020-01-01';
        const monthReported = formatMonth(loan.Maturity) || '2020-01';
        
        const balance = parseFloat(loan.Balance || loan.TotalBalance || loan.Total || '0');
        const collected = parseFloat(loan.TotalPayment || '0');
        const total = parseFloat(loan.Total || '0');

        await client.query(`
            INSERT INTO loans (
                id, collector, code, first_name, last_name, borrower_name,
                month_reported, due_date, outstanding_balance, amount_collected,
                running_balance, status, location, branch
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            ON CONFLICT (id) DO UPDATE SET
                collector = EXCLUDED.collector,
                code = EXCLUDED.code,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                borrower_name = EXCLUDED.borrower_name,
                month_reported = EXCLUDED.month_reported,
                due_date = EXCLUDED.due_date,
                outstanding_balance = EXCLUDED.outstanding_balance,
                amount_collected = EXCLUDED.amount_collected,
                running_balance = EXCLUDED.running_balance,
                status = EXCLUDED.status;
        `, [
            loan.LoanID,
            loan.CollectorFname || loan.Collector || 'Unknown',
            loan.Code || '0',
            loan.FirstName || 'Unknown',
            loan.Customer || 'Unknown',
            `${loan.FirstName || ''} ${loan.Customer || ''}`.trim() || 'Unknown',
            monthReported,
            maturityDate,
            total,
            collected,
            balance,
            'Good',
            'NL',
            loan.BranchID || 'Main'
        ]);
        loansInserted++;
    }
    console.log(`Processed ${loansInserted} loans.`);

    console.log('Reading payments.csv...');
    const paymentsStream = fs.createReadStream('payments.csv');
    const rlPayments = readline.createInterface({ input: paymentsStream });
    let isPaymentHeader = true;
    let paymentHeaders = [];
    let paymentsInserted = 0;
    let paymentsSkipped = 0;

    for await (const line of rlPayments) {
        if (isPaymentHeader) {
            paymentHeaders = parseCSVLine(line);
            isPaymentHeader = false;
            continue;
        }
        const values = parseCSVLine(line);
        const payment = {};
        paymentHeaders.forEach((h, i) => payment[h] = values[i]);

        if (!payment.ID || !payment.LoanID) continue;

        const paymentDate = formatDate(payment.Date);
        if (!paymentDate) continue;

        // Check for existing payment with same date
        const existing = await client.query(`
            SELECT id FROM payments WHERE loan_id = $1 AND date = $2
        `, [payment.LoanID, paymentDate]);

        if (existing.rows.length > 0) {
            paymentsSkipped++;
            continue;
        }

        const amount = parseFloat(payment.PaymentsMade || '0');
        const balanceAfter = parseFloat(payment.NewBalance || '0');
        const orNumber = `OR-${payment.ID}`;

        await client.query(`
            INSERT INTO payments (
                id, loan_id, amount, or_number, date, balance_after, recorder, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            )
            ON CONFLICT (id) DO NOTHING;
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
        paymentsInserted++;
    }

    console.log(`Processed ${paymentsInserted} payments. Skipped ${paymentsSkipped} duplicate dates.`);
    await client.end();
}

run().catch(console.error);
