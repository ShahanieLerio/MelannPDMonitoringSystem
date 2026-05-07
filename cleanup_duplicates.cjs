const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    
    // Delete duplicate Morata (old ID 10368) and its payments
    await c.query("DELETE FROM payments WHERE loan_id = '10368'");
    await c.query("DELETE FROM loans WHERE id = '10368'");
    console.log("Deleted duplicate Morata (10368).");
    
    // Delete garbage "Unknown" loans with code '0'
    const unkLoans = await c.query("SELECT id FROM loans WHERE code = '0'");
    if (unkLoans.rows.length > 0) {
        for (const row of unkLoans.rows) {
            await c.query("DELETE FROM payments WHERE loan_id = $1", [row.id]);
        }
        await c.query("DELETE FROM loans WHERE code = '0'");
        console.log(`Deleted ${unkLoans.rows.length} garbage "Unknown" loans with code 0.`);
    }
    
    await c.end();
}

run().catch(console.error);
