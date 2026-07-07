/**
 * fix_reported_amount_all.cjs
 * 
 * One-time migration: Fix the outstanding_balance (Reported Amount) for ALL loans.
 * 
 * Logic:
 * - For each loan, the "Reported Amount" = the client's balance at the time 
 *   they were reported as past due.
 * - The cutoff is the FIRST DAY of the month_reported.
 * - Find the last GOOD payment with date STRICTLY BEFORE that cutoff.
 * - The balance_after of that payment = the correct Reported Amount.
 * - If no payments exist before the cutoff, the total_loan IS the reported amount
 *   (they never paid anything before being reported).
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    
    try {
        console.log('=== FIX REPORTED AMOUNT (outstanding_balance) FOR ALL LOANS ===\n');
        
        // Fetch all loans
        const loansRes = await client.query(`
            SELECT id, borrower_name, due_date, month_reported, outstanding_balance, total_loan 
            FROM loans 
            ORDER BY borrower_name
        `);
        console.log(`Total loans: ${loansRes.rowCount}`);
        
        await client.query('BEGIN');
        
        let updatedCount = 0;
        let skippedCount = 0;
        let alreadyCorrectCount = 0;
        const changes = [];
        
        for (const loan of loansRes.rows) {
            const monthReported = loan.month_reported; // YYYY-MM format
            if (!monthReported) {
                skippedCount++;
                continue;
            }
            
            const cutoffDate = monthReported + '-01'; // First day of reported month
            
            // Find last GOOD payment strictly before the reported month
            const paymentRes = await client.query(
                `SELECT balance_after FROM payments 
                 WHERE loan_id = $1 AND status = 'GOOD' AND date < $2 
                 ORDER BY date DESC LIMIT 1`,
                [loan.id, cutoffDate]
            );
            
            let expectedReportedAmount;
            if (paymentRes.rows.length === 0) {
                // No payments before reported month = total_loan is the reported amount
                expectedReportedAmount = parseFloat(loan.total_loan) || 0;
            } else {
                expectedReportedAmount = parseFloat(paymentRes.rows[0].balance_after);
            }
            
            const currentReportedAmount = parseFloat(loan.outstanding_balance);
            
            // Only update if different
            if (Math.abs(currentReportedAmount - expectedReportedAmount) > 0.01) {
                await client.query(
                    'UPDATE loans SET outstanding_balance = $1 WHERE id = $2',
                    [expectedReportedAmount, loan.id]
                );
                updatedCount++;
                changes.push({
                    name: loan.borrower_name,
                    id: loan.id,
                    old: currentReportedAmount,
                    new: expectedReportedAmount
                });
            } else {
                alreadyCorrectCount++;
            }
        }
        
        await client.query('COMMIT');
        
        console.log(`\n=== RESULTS ===`);
        console.log(`Already correct: ${alreadyCorrectCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped (no month_reported): ${skippedCount}`);
        
        if (changes.length > 0) {
            console.log(`\n=== ALL CHANGES MADE ===`);
            changes.forEach(c => {
                console.log(`  ${c.name} (${c.id}): ${c.old} → ${c.new}`);
            });
        }
        
        // Verify with known samples
        console.log('\n=== VERIFICATION ===');
        const verifyRes = await client.query(`
            SELECT borrower_name, outstanding_balance, total_loan, month_reported
            FROM loans 
            WHERE borrower_name ILIKE '%Abainza%' OR borrower_name ILIKE '%Abucay%'
        `);
        verifyRes.rows.forEach(r => {
            console.log(`  ${r.borrower_name}: Reported Amount = ${r.outstanding_balance}, Total Loan = ${r.total_loan}, Month Reported = ${r.month_reported}`);
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERROR - Transaction rolled back:', err);
    } finally {
        client.release();
        pool.end();
    }
}

main().catch(console.error);
