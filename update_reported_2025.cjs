const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { getReportedDateForDueDate } = require('./reportingCycle.cjs');
const { calculateReportedAmount } = require('./reportedAmount.cjs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const apply = process.argv.includes('--apply');

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            "SELECT id, code, borrower_name, branch, due_date, month_reported, total_loan, amount_collected, outstanding_balance FROM loans WHERE due_date >= '2025-01-01' ORDER BY id FOR UPDATE"
        );
        const paymentsResult = await client.query(
            "SELECT p.loan_id, p.amount, p.date, p.status, p.remarks FROM payments p JOIN loans l ON l.id = p.loan_id WHERE l.due_date >= '2025-01-01'"
        );
        const paymentsByLoan = new Map();
        for (const payment of paymentsResult.rows) {
            if (!paymentsByLoan.has(payment.loan_id)) paymentsByLoan.set(payment.loan_id, []);
            paymentsByLoan.get(payment.loan_id).push(payment);
        }
        const changes = result.rows.map(row => {
            const afterDate = getReportedDateForDueDate(row.due_date);
            const financials = calculateReportedAmount(row, paymentsByLoan.get(row.id) || [], afterDate);
            return {
                id: row.id,
                code: row.code,
                borrowerName: row.borrower_name,
                dueDate: row.due_date,
                beforeDate: row.month_reported,
                afterDate,
                beforeReportedAmount: Number(row.outstanding_balance),
                afterReportedAmount: financials.reportedAmount,
                sourceAdjustment: financials.sourceAdjustment,
                cashBeforeReport: financials.cashBeforeReport
            };
        }).filter(row => row.beforeDate !== row.afterDate || row.beforeReportedAmount !== row.afterReportedAmount);

        if (!apply) {
            const monthChanges = changes.filter(row => row.beforeDate?.slice(0, 7) !== row.afterDate.slice(0, 7));
            const amountChanges = changes.filter(row => row.beforeReportedAmount !== row.afterReportedAmount);
            const reportedAmountDelta = Math.round(amountChanges.reduce((sum, row) => sum + row.afterReportedAmount - row.beforeReportedAmount, 0) * 100) / 100;
            console.log(JSON.stringify({ mode: 'dry-run', inspected: result.rowCount, changes: changes.length, differentMonthCount: monthChanges.length, reportedAmountChanges: amountChanges.length, reportedAmountDelta, differentMonthSample: monthChanges.slice(0, 8), amountChangeSample: amountChanges.slice(0, 12), adaro: changes.find(row => row.id === '41062') }, null, 2));
            await client.query('ROLLBACK');
            return;
        }

        if (changes.length === 0) {
            await client.query('ROLLBACK');
            console.log('No reporting dates or reported amounts need updating.');
            return;
        }

        const backupDir = path.join(__dirname, 'generated-reports');
        fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `reported-cycle-and-amount-backup-${stamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), changes }, null, 2));

        for (const row of changes) {
            const updated = await client.query(
                'UPDATE loans SET month_reported = $1, outstanding_balance = $2 WHERE id = $3 AND month_reported = $4 AND outstanding_balance = $5',
                [row.afterDate, row.afterReportedAmount, row.id, row.beforeDate, row.beforeReportedAmount]
            );
            if (updated.rowCount !== 1) throw new Error(`Reporting date changed during update for loan ${row.id}.`);
        }
        await client.query('COMMIT');
        console.log(JSON.stringify({ mode: 'applied', updated: changes.length, backupPath }, null, 2));
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
