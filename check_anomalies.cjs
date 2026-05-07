const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'});
    await c.connect();
    
    console.log("=== MORATA ===");
    const morata = await c.query("SELECT id, code, borrower_name, outstanding_balance, amount_collected, running_balance FROM loans WHERE code = '1384'");
    console.log(morata.rows);
    
    console.log("=== ARCALA ===");
    const arcala = await c.query("SELECT id, code, borrower_name, outstanding_balance, amount_collected, running_balance FROM loans WHERE code = '77'");
    console.log(arcala.rows);
    
    console.log("=== UNKNOWN ===");
    const unknown = await c.query("SELECT count(*) FROM loans WHERE code = '0'");
    console.log('Unknown loans:', unknown.rows[0].count);
    
    await c.end();
}
run();
