const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local', quiet: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const apply = process.argv.includes('--apply');

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const loanResult = await client.query('SELECT * FROM loans WHERE id = $1 FOR UPDATE', ['3939']);
        const loan = loanResult.rows[0];
        if (!loan || loan.code !== '47' || loan.borrower_name !== 'COLO, AIZA') {
            throw new Error('COLO, AIZA identity check failed.');
        }
        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE loan_id = $1 ORDER BY date ASC, created_at ASC, id ASC FOR UPDATE',
            [loan.id]
        );
        const payments = paymentResult.rows;
        const postedCorrection = payments.find(payment =>
            payment.id === 'k5toyo1' && payment.date === '2020-02-04' &&
            Number(payment.amount) === 2 && payment.status === 'GOOD'
        );
        if (!postedCorrection || payments.length !== 224 || payments.some(payment => payment.status !== 'GOOD')) {
            throw new Error('Expected February 4 correction or payment stream changed.');
        }

        const paymentTotal = Math.round(payments.reduce((sum, payment) => sum + Number(payment.amount), 0) * 100) / 100;
        const totalLoan = Number(loan.total_loan);
        if (totalLoan !== 6976 || Number(loan.amount_collected) !== 5552 ||
            Number(loan.running_balance) !== 1424 || paymentTotal !== 5550) {
            throw new Error('Loan totals changed; review the account before applying this reconciliation.');
        }

        let balance = totalLoan;
        const paymentBalanceChanges = [];
        for (const payment of payments) {
            balance = Math.round((balance - Number(payment.amount)) * 100) / 100;
            if (Number(payment.balance_after) !== balance) {
                paymentBalanceChanges.push({ id: payment.id, before: Number(payment.balance_after), after: balance });
            }
        }
        if (balance !== 1426) throw new Error(`Unexpected final balance ${balance}.`);

        if (!apply) {
            console.log(JSON.stringify({ mode: 'dry-run', loanId: loan.id, paymentTotal, correctedRunningBalance: balance, paymentBalanceChanges: paymentBalanceChanges.length }, null, 2));
            await client.query('ROLLBACK');
            return;
        }

        const backupPath = path.join(__dirname, '..', 'generated-reports',
            `colo-aiza-reconciliation-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(backupPath, JSON.stringify({ loan, payments, paymentBalanceChanges }, null, 2), { flag: 'wx' });

        for (const change of paymentBalanceChanges) {
            const updated = await client.query(
                'UPDATE payments SET balance_after = $1 WHERE id = $2 AND balance_after = $3',
                [change.after, change.id, change.before]
            );
            if (updated.rowCount !== 1) throw new Error(`Payment ${change.id} changed during reconciliation.`);
        }
        const updatedLoan = await client.query(
            'UPDATE loans SET amount_collected = $1, running_balance = $2 WHERE id = $3 AND amount_collected = $4 AND running_balance = $5',
            [paymentTotal, balance, loan.id, loan.amount_collected, loan.running_balance]
        );
        if (updatedLoan.rowCount !== 1) throw new Error('Loan changed during reconciliation.');
        await client.query(
            'INSERT INTO activity_logs (id, loan_id, type, description, user_name, user_role, module) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [randomUUID(), loan.id, 'Balance Reconciliation',
                'Corrected double-counted PHP 2 source adjustment after the missing 2020-02-04 payment was posted. Amount collected: PHP 5,550; running balance: PHP 1,426.',
                'Codex (user-requested)', 'System', 'Financial Collection']
        );
        await client.query('COMMIT');
        console.log(JSON.stringify({ mode: 'applied', loanId: loan.id, amountCollected: paymentTotal, runningBalance: balance, paymentBalanceChanges: paymentBalanceChanges.length, backupPath }, null, 2));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
