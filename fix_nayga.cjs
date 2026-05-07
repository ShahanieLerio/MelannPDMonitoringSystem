const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });
    await client.connect();

    // Fix Nayga's outstanding_balance to be equal to her total_loan
    await client.query(`
        UPDATE loans 
        SET outstanding_balance = 18530, running_balance = 11710
        WHERE id = '8zyvd36'
    `);
    
    console.log('Fixed Nayga outstanding_balance to 18530.');
    await client.end();
}

run().catch(console.error);
