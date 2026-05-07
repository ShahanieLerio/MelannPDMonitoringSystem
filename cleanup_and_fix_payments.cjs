/**
 * cleanup_and_fix_payments.cjs
 * 
 * This script:
 * 1. Identifies the REAL loan records (the ones user sees in the UI) for each borrower
 * 2. Updates their codes to the correct values (1064, 1254, 957, 1423)
 * 3. Transfers all payments from duplicate CSV-imported loans to the real ones
 * 4. Deletes the duplicate CSV-imported loan records
 */
const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');

// Mapping: REAL loan ID (UI records) → correct code, and CSV duplicate ID
const FIXES = [
    {
        realId: '2axtq0b',
        oldCode: '3620',
        correctCode: '1064',
        csvDupeId: '42356',
        borrower: 'Alvarez, Richard Jr.'
    },
    {
        realId: '6ubw174',
        oldCode: '1257',
        correctCode: '1254',
        csvDupeId: '8239',
        borrower: 'Manatad, Jessica'
    },
    {
        realId: '8zyvd36',
        oldCode: '957',
        correctCode: '957',
        csvDupeId: '16245',
        borrower: 'Nayga, Rosela'
    },
    {
        realId: 'a9v9wfq',
        oldCode: '1426',
        correctCode: '1423',
        csvDupeId: '11051',
        borrower: 'Velarde, Cleofe'
    }
];

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();
    console.log('Connected to database.\n');

    // ── STEP 0: Show current state ──────────────────────────────────────────
    console.log('=== BEFORE cleanup ===\n');
    for (const fix of FIXES) {
        const realLoan = await client.query(`SELECT id, code, borrower_name FROM loans WHERE id = $1`, [fix.realId]);
        const dupeLoan = await client.query(`SELECT id, code, borrower_name FROM loans WHERE id = $1`, [fix.csvDupeId]);
        const realPayments = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = $1`, [fix.realId]);
        const dupePayments = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = $1`, [fix.csvDupeId]);
        
        console.log(`${fix.borrower}:`);
        console.log(`  REAL record (${fix.realId}): code=${realLoan.rows[0]?.code}, ${realPayments.rows[0].count} payments`);
        if (dupeLoan.rows.length > 0) {
            console.log(`  DUPE record (${fix.csvDupeId}): code=${dupeLoan.rows[0]?.code}, ${dupePayments.rows[0].count} payments`);
        } else {
            console.log(`  DUPE record (${fix.csvDupeId}): NOT FOUND`);
        }
    }

    // ── Begin transaction ──────────────────────────────────────────────────
    await client.query('BEGIN');

    try {
        for (const fix of FIXES) {
            console.log(`\n--- Processing ${fix.borrower} ---`);

            // STEP 1: Update the code on the REAL record
            if (fix.oldCode !== fix.correctCode) {
                await client.query(`UPDATE loans SET code = $1 WHERE id = $2`, [fix.correctCode, fix.realId]);
                console.log(`  ✓ Updated code: ${fix.oldCode} → ${fix.correctCode}`);
            } else {
                console.log(`  ✓ Code already correct: ${fix.correctCode}`);
            }

            // STEP 2: Check if duplicate exists
            const dupeExists = await client.query(`SELECT id FROM loans WHERE id = $1`, [fix.csvDupeId]);
            if (dupeExists.rows.length === 0) {
                console.log(`  ✓ No duplicate record to clean up`);
                continue;
            }

            // STEP 3: Get payments from the duplicate record
            const dupePayments = await client.query(
                `SELECT * FROM payments WHERE loan_id = $1 ORDER BY date`,
                [fix.csvDupeId]
            );
            console.log(`  Found ${dupePayments.rows.length} payments on duplicate record`);

            // STEP 4: Delete payments from duplicate (must do before we can re-insert with new loan_id)
            await client.query(`DELETE FROM payments WHERE loan_id = $1`, [fix.csvDupeId]);
            console.log(`  ✓ Deleted payments from duplicate`);

            // STEP 5: Delete existing payments on real loan to avoid conflicts
            await client.query(`DELETE FROM payments WHERE loan_id = $1`, [fix.realId]);
            console.log(`  ✓ Cleared existing payments on real record`);

            // STEP 6: Re-insert payments pointing to the REAL loan ID
            let insertCount = 0;
            for (const p of dupePayments.rows) {
                const newId = `${p.id}-R${fix.realId}`;
                const newOr = `OR-${p.id}-R${fix.realId}`;
                try {
                    await client.query(`
                        INSERT INTO payments (id, loan_id, amount, or_number, date, balance_after, recorder, status, remarks, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (loan_id, date) DO UPDATE SET
                            amount = EXCLUDED.amount,
                            or_number = EXCLUDED.or_number,
                            balance_after = EXCLUDED.balance_after,
                            recorder = EXCLUDED.recorder,
                            status = EXCLUDED.status
                    `, [newId, fix.realId, p.amount, newOr, p.date, p.balance_after, p.recorder, p.status, p.remarks, p.created_at]);
                    insertCount++;
                } catch (err) {
                    console.error(`    WARN: payment ${p.id} → ${err.message}`);
                }
            }
            console.log(`  ✓ Transferred ${insertCount} payments to real record (${fix.realId})`);

            // STEP 7: Delete any remarks, activity logs, and demand letters tied to the duplicate
            await client.query(`DELETE FROM remarks WHERE loan_id = $1`, [fix.csvDupeId]);
            await client.query(`DELETE FROM activity_logs WHERE loan_id = $1`, [fix.csvDupeId]);
            await client.query(`DELETE FROM demand_letters WHERE loan_id = $1`, [fix.csvDupeId]);

            // STEP 8: Delete the duplicate loan record
            await client.query(`DELETE FROM loans WHERE id = $1`, [fix.csvDupeId]);
            console.log(`  ✓ Deleted duplicate loan record (${fix.csvDupeId})`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Transaction committed successfully.\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Transaction ROLLED BACK due to error:', err.message);
        await client.end();
        process.exit(1);
    }

    // ── FINAL VERIFICATION ──────────────────────────────────────────────────
    console.log('=== AFTER cleanup ===\n');
    for (const fix of FIXES) {
        const realLoan = await client.query(`SELECT id, code, borrower_name FROM loans WHERE id = $1`, [fix.realId]);
        const dupeLoan = await client.query(`SELECT id FROM loans WHERE id = $1`, [fix.csvDupeId]);
        const realPayments = await client.query(`SELECT COUNT(*) FROM payments WHERE loan_id = $1`, [fix.realId]);
        
        console.log(`${fix.borrower}:`);
        console.log(`  REAL record (${fix.realId}): code=${realLoan.rows[0]?.code}, ${realPayments.rows[0].count} payments`);
        console.log(`  DUPE record (${fix.csvDupeId}): ${dupeLoan.rows.length > 0 ? 'STILL EXISTS ⚠️' : 'DELETED ✓'}`);
    }

    await client.end();
    console.log('\nDone.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
