const { Client } = require('pg');

async function verifyMigration() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    
    try {
        await client.connect();
        console.log("=== DATA MIGRATION VERIFICATION ===");

        // 1. Check Total Counts
        const loansRes = await client.query('SELECT COUNT(*) as count FROM loans');
        const paymentsRes = await client.query('SELECT COUNT(*) as count FROM payments');
        console.log(`\nTotal Loans: ${loansRes.rows[0].count}`);
        console.log(`Total Payments: ${paymentsRes.rows[0].count}`);

        // 2. Check for Duplicate Loans
        // Since code might be duplicated if a borrower renewed (though usually not in the same month_reported)
        const dupLoans = await client.query(`
            SELECT code, borrower_name, count(*) 
            FROM loans 
            GROUP BY code, borrower_name 
            HAVING count(*) > 1
        `);
        if (dupLoans.rows.length > 0) {
            console.log("\n[WARNING] Duplicate Loan Codes Found:");
            dupLoans.rows.forEach(r => {
                console.log(`  - Code: ${r.code}, Name: ${r.borrower_name}, Count: ${r.count}`);
            });
        } else {
            console.log("\n[OK] No exact duplicate loan codes found for the same borrower.");
        }

        // Wait, did different borrowers share the same code?
        const crossSharedCodes = await client.query(`
            SELECT code, count(DISTINCT borrower_name) as names 
            FROM loans 
            GROUP BY code 
            HAVING count(DISTINCT borrower_name) > 1
        `);
        if (crossSharedCodes.rows.length > 0) {
            console.log("\n[WARNING] Loan Codes Shared by Different Borrowers:");
            for (let row of crossSharedCodes.rows) {
                const names = await client.query(`SELECT id, borrower_name FROM loans WHERE code = $1`, [row.code]);
                console.log(`  - Code: ${row.code} is shared by:`);
                names.rows.forEach(n => console.log(`      > ID: ${n.id}, Name: ${n.borrower_name}`));
            }
        } else {
            console.log("[OK] No loan codes are shared by different borrowers.");
        }

        // 3. Check for Duplicate Payments
        // Exact duplicate: same loan_id, date, amount, and status
        const dupPayments = await client.query(`
            SELECT loan_id, date, amount, count(*) 
            FROM payments 
            GROUP BY loan_id, date, amount 
            HAVING count(*) > 1
        `);
        if (dupPayments.rows.length > 0) {
            console.log(`\n[WARNING] Found ${dupPayments.rows.length} potentially duplicate payments (same loan, date, amount):`);
            // Show first 5
            dupPayments.rows.slice(0, 5).forEach(r => {
                console.log(`  - Loan ID: ${r.loan_id}, Date: ${r.date}, Amount: ${r.amount}, Count: ${r.count}`);
            });
            if (dupPayments.rows.length > 5) console.log(`  ... and ${dupPayments.rows.length - 5} more.`);
        } else {
            console.log("\n[OK] No duplicate payments found (same loan, date, amount).");
        }

        // 4. Verification of Balance logic
        const invalidBalances = await client.query(`
            SELECT id, code, borrower_name, outstanding_balance, amount_collected, running_balance 
            FROM loans 
            WHERE running_balance < 0
        `);
        if (invalidBalances.rows.length > 0) {
            console.log(`\n[WARNING] Found ${invalidBalances.rows.length} loans with negative running balance!`);
            invalidBalances.rows.slice(0, 3).forEach(r => {
                console.log(`  - Code: ${r.code}, Name: ${r.borrower_name}, Bal: ${r.running_balance}`);
            });
        } else {
            console.log("\n[OK] All running balances are 0 or positive.");
        }

        console.log("\n=== VERIFICATION COMPLETE ===");

    } catch (err) {
        console.error("Error during verification:", err);
    } finally {
        await client.end();
    }
}

verifyMigration();
