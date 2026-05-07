const { Client } = require('pg');

async function fix() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // 1. Get all Numeric IDs (Access records)
    const resNumeric = await client.query(`SELECT * FROM loans WHERE id ~ '^[0-9]+$'`);
    
    // 2. Get all Alpha IDs (Web App records)
    const resAlpha = await client.query(`SELECT * FROM loans WHERE id !~ '^[0-9]+$'`);

    let mergedCount = 0;
    
    for (let acc of resNumeric.rows) {
        // Find matching Web App record by Code and approx name match
        const matches = resAlpha.rows.filter(w => w.code === acc.code);
        
        if (matches.length > 0) {
            // Take the first match
            const wApp = matches[0];
            
            // Re-assign payments from Access ID to Web App ID
            await client.query(`UPDATE payments SET loan_id = $1 WHERE loan_id = $2`, [wApp.id, acc.id]);
            
            // Update Web App loan details with Access loan details
            await client.query(`
                UPDATE loans SET 
                    outstanding_balance = $1,
                    amount_collected = $2,
                    running_balance = $3,
                    due_date = $4,
                    month_reported = $5,
                    status = $6
                WHERE id = $7
            `, [
                acc.outstanding_balance,
                acc.amount_collected,
                acc.running_balance,
                acc.due_date,
                acc.month_reported,
                'Good', // Keep it Good
                wApp.id
            ]);

            // Delete the duplicate Access record
            await client.query(`DELETE FROM loans WHERE id = $1`, [acc.id]);
            mergedCount++;
        }
    }

    console.log(`Successfully merged ${mergedCount} duplicate Access records into existing Web App records!`);
    
    await client.end();
}
fix();
